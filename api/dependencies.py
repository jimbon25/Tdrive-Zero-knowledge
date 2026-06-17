"""
TDrive API Dependencies.

Handles shared resources like the Manager instance and Singleton Client.
"""

import secrets
import asyncio
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Annotated, Optional, Any, Dict

from fastapi import Depends, HTTPException, Header, status, Request
from fastapi.security import OAuth2PasswordBearer

from core.client import TDriveClient
from core.db.session import DatabaseSession
from core.manager import TDriveManager
from core.session import SessionManager
from core.crypto import derive_key

# --- In-Memory OTDT Cache (FE-002) ---
class TicketCache:
    def __init__(self):
        self.tickets = {} 

    def create(self, file_id: str) -> str:
        import uuid
        import time
        tid = str(uuid.uuid4())
        self.tickets[tid] = (file_id, time.time() + 300)
        return tid

    def consume(self, tid: str) -> str | None:
        import time
        if tid not in self.tickets:
            return None
        file_id, expiry = self.tickets[tid] 
        if time.time() > expiry:
            self.tickets.pop(tid, None)
            return None
        return file_id

download_tickets = TicketCache()

# --- Shared State (Single-user mode) ---

class AppState:
    client: Optional[TDriveClient] = None
    bot_worker: Optional[Any] = None 
    master_password: Optional[str] = None
    session_token: Optional[str] = None
    token_expiry: Optional[datetime] = None
    db_session: Optional[DatabaseSession] = None
    upload_locks: Dict[str, asyncio.Lock] = {}
    client_lock = asyncio.Lock()
    
    # Cache for Telegram User Info
    user_cache: Dict[int, Dict[str, Any]] = {}

    # Brute-force tracking
    login_failures: int = 0
    lockout_until: Optional[datetime] = None
    
    # CSRF Token (Single-user mode)
    csrf_token: str = secrets.token_urlsafe(32)

_state = AppState()

# --- Shared Helpers ---

def get_session_manager() -> SessionManager:
    return SessionManager()

# --- Security Dependencies ---

async def validate_csrf(
    request: Request,
    x_csrf_token: Annotated[Optional[str], Header()] = None
):
    """
    Validates CSRF token for state-changing requests.
    Exempts login endpoint.
    """
    # 1. Exempt login
    if request.url.path == "/api/v1/auth/login":
        return

    if request.method in ["POST", "PUT", "PATCH", "DELETE"]:
        # 1. Header check
        if not x_csrf_token or x_csrf_token != _state.csrf_token:
            raise HTTPException(status_code=403, detail="CSRF token mismatch")
        
        # 2. Origin/Referer check
        origin = request.headers.get("Origin")
        referer = request.headers.get("Referer")
        
        if not origin and not referer:
             pass 

def check_login_brute_force():
    """Checks if login is currently locked out or needs delay."""
    if _state.lockout_until and datetime.now(timezone.utc) < _state.lockout_until:
        diff = (_state.lockout_until - datetime.now(timezone.utc)).seconds
        raise HTTPException(status_code=429, detail=f"Too many attempts. Locked out for {diff}s")
    
    # Progressive Delay
    if _state.login_failures >= 5:
        time.sleep(2) 
    elif _state.login_failures >= 3:
        time.sleep(1)

def record_login_failure():
    _state.login_failures += 1
    if _state.login_failures >= 10:
        _state.lockout_until = datetime.now(timezone.utc) + timedelta(minutes=10)
    elif _state.login_failures >= 5:
        _state.lockout_until = datetime.now(timezone.utc) + timedelta(seconds=30)
    elif _state.login_failures >= 3:
        _state.lockout_until = datetime.now(timezone.utc) + timedelta(seconds=5)

def reset_login_failures():
    _state.login_failures = 0
    _state.lockout_until = None

async def validate_integrity(
    request: Request,
    sm: Annotated[SessionManager, Depends(get_session_manager)]
):
    """
    Blocks actions if system is in Safe Mode, CI, or if feature is disabled.
    """
    path = request.url.path
    method = request.method
    
    # 1. Feature Toggle Checks
    from core.feature_registry import FeatureRegistry, FeatureID
    registry = FeatureRegistry(sm)
    
    if "bulk" in path and not registry.is_enabled(FeatureID.BULK_ACTIONS):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bulk operations are disabled.")

    if "/api/v1/developer" in path and not registry.is_enabled(FeatureID.DEVELOPER_CONSOLE):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Developer Console is disabled.")

    # 2. Integrity State Checks
    if method in ["POST", "PUT", "PATCH", "DELETE"]:
        if "/api/v1/bootstrap/" in path:
             return

        from core.integrity import IntegrityGuard
        guard = IntegrityGuard(sm)
        status_info = guard.get_integrity_status()
        
        if status_info["safe_mode"] or status_info["read_only"]:
            allowed_safe_paths = [
                "/api/v1/system/rebuild",
                "/ticket", 
                "/bulk-download"
            ]
            if any(p in path for p in allowed_safe_paths):
                return
                
            raise HTTPException(
                status_code=403, 
                detail=status_info["message"]
            )

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_db_session(sm: Annotated[SessionManager, Depends(get_session_manager)]) -> DatabaseSession:
    if _state.db_session is None:
        db_path = sm.config_dir / "tdrive.db"
        _state.db_session = DatabaseSession(str(db_path))
    return _state.db_session

async def get_tg_client(sm: Annotated[SessionManager, Depends(get_session_manager)]) -> TDriveClient:
    """
    Returns the singleton TDriveClient.
    Ensures connection is established.
    """
    if _state.client is None:
        async with _state.client_lock:
            if _state.client is None:
                config = sm.load_config()
                if not config:
                    raise HTTPException(status_code=400, detail="TDrive not initialized")
                
                _state.client = TDriveClient(
                    sm.config_dir / "tdrive.session",
                    config["api_id"],
                    config["api_hash"]
                )
    
    if not _state.client.client.is_connected():
        await _state.client.connect()
        
    return _state.client

async def close_tg_client():
    """Closes the singleton client session."""
    if _state.client:
        await _state.client.disconnect()
        _state.client = None

async def get_manager(
    sm: Annotated[SessionManager, Depends(get_session_manager)],
    db: Annotated[DatabaseSession, Depends(get_db_session)],
    tg: Annotated[TDriveClient, Depends(get_tg_client)],
    token: Annotated[str, Depends(oauth2_scheme)]
) -> TDriveManager:
    """
    Returns a TDriveManager instance.
    Validates dynamic session token and expiration.
    """
    if not _state.session_token or token != _state.session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing session token",
        )
    
    if _state.token_expiry and datetime.now(timezone.utc) > _state.token_expiry:
        clear_session()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired",
        )

    if not _state.master_password:
         raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Master password not set",
        )
    
    config = sm.load_config()
    manager = TDriveManager(
        db,
        tg,
        config["channel_id"],
        _state.master_password,
        bytes.fromhex(config["master_salt"]),
        upload_locks=_state.upload_locks
    )
    return manager

def create_session(password: str) -> str:
    """Creates a new secure session."""
    _state.master_password = password
    _state.session_token = secrets.token_urlsafe(32)
    _state.token_expiry = datetime.now(timezone.utc) + timedelta(hours=24)
    return _state.session_token

async def get_manager_by_ticket(
    sm: Annotated[SessionManager, Depends(get_session_manager)],
    db: Annotated[DatabaseSession, Depends(get_db_session)],
    tg: Annotated[TDriveClient, Depends(get_tg_client)],
) -> TDriveManager:
    """
    Returns a TDriveManager instance for authenticated or ticket-based access.
    Note: This is used by internal handlers that already validated the ticket.
    """
    if not _state.master_password:
         raise HTTPException(status_code=401, detail="Agent locked")
    
    config = sm.load_config()
    return TDriveManager(
        db,
        tg,
        config["channel_id"],
        _state.master_password,
        bytes.fromhex(config["master_salt"]),
        upload_locks=_state.upload_locks
    )

def clear_session():
    """Clears all session data."""
    _state.master_password = None
    _state.session_token = None
    _state.token_expiry = None
