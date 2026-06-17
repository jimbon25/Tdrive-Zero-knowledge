"""
TDrive System Routes.
"""

import logging
import asyncio
import subprocess
import base64
from typing import Annotated, List

from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import text

from api.dependencies import get_manager, get_session_manager, validate_csrf
from api.schemas import (
    SystemStatus, StructuredResponse, IntegrityInfo,
    ServiceStatus, ServiceActionRequest, ServiceLogResponse,
    UnlockRequest
)
from core.db.session import DatabaseSession
from core.db.manager import DBManager
from core.manager import TDriveManager
from core.session import SessionManager
from core.integrity import IntegrityGuard
from core.feature_registry import FeatureRegistry

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/status", response_model=StructuredResponse[SystemStatus])
async def get_status(
    manager: Annotated[TDriveManager, Depends(get_manager)],
    sm: Annotated[SessionManager, Depends(get_session_manager)]
):
    """
    Returns the current operational status of the TDrive agent with storage metrics.
    """
    active_size = 0
    trash_size = 0
    
    sqlite_healthy = False
    try:
        with manager.db_session.get_session() as session:
            from sqlalchemy import text
            session.execute(text("SELECT 1"))
            sqlite_healthy = True
            
            db = DBManager(session)
            all_files = db.list_files(include_trashed=True)
            for f in all_files:
                if f.is_trashed:
                    trash_size += f.size
                else:
                    active_size += f.size
    except Exception:
        sqlite_healthy = False

    guard = IntegrityGuard(sm)
    integrity = guard.get_integrity_status()
    
    registry = FeatureRegistry(sm)

    # Get Telegram Profile if connected
    tg_username = None
    tg_photo_b64 = None
    if manager.tg_client.client.is_connected():
        try:
            me = await manager.tg_client.client.get_me()
            if me:
                tg_username = me.username or f"{me.first_name or ''} {me.last_name or ''}".strip() or str(me.id)
                
                # Download profile photo as bytes and convert to base64
                photo_bytes = await manager.tg_client.client.download_profile_photo('me', file=bytes)
                if photo_bytes:
                    tg_photo_b64 = f"data:image/jpeg;base64,{base64.b64encode(photo_bytes).decode()}"
        except Exception as e:
            logging.error(f"Failed to fetch Telegram profile: {e}")

    # Bot Status
    from api.dependencies import _state
    bot_info = None
    config = sm.load_config()
    auth_users = config.get("bot_authorized_users", [])
    auth_user_details = []

    # Try to fetch details for authorized users if bot is active
    if auth_users:
        for uid in auth_users:
            # Check cache first
            if uid in _state.user_cache:
                auth_user_details.append(_state.user_cache[uid])
                continue
            
            # If not in cache and bot is online, try to fetch
            if _state.bot_worker and _state.bot_worker.is_connected():
                try:
                    user = await _state.bot_worker.client.get_entity(uid)
                    from api.schemas import AuthorizedUserInfo
                    detail = AuthorizedUserInfo(
                        id=user.id,
                        username=user.username,
                        first_name=user.first_name,
                        last_name=user.last_name
                    )
                    _state.user_cache[uid] = detail.model_dump()
                    auth_user_details.append(detail.model_dump())
                except Exception as e:
                    logging.warning(f"Failed to fetch details for user {uid}: {e}")
                    # Fallback to ID only
                    auth_user_details.append({"id": uid})
            else:
                # Bot offline, fallback to ID
                auth_user_details.append({"id": uid})

    if _state.bot_worker:
        from api.schemas import BotInfo
        bot_info = BotInfo(
            is_active=_state.bot_worker.is_connected(),
            username=_state.bot_worker.username,
            has_authorized_user=len(auth_users) > 0,
            authorized_users=auth_users,
            authorized_user_details=auth_user_details
        )
    elif config.get("bot_token"):
        from api.schemas import BotInfo
        bot_info = BotInfo(
            is_active=False,
            username=None,
            has_authorized_user=len(auth_users) > 0,
            authorized_users=auth_users,
            authorized_user_details=auth_user_details
        )

    return StructuredResponse(
        success=True,
        data=SystemStatus(
            telegram_connected=manager.tg_client.client.is_connected(),
            telegram_username=tg_username,
            telegram_profile_photo=tg_photo_b64,
            session_valid=True,
            sqlite_healthy=sqlite_healthy,
            config_exists=True,
            channel_accessible=True,
            dev_mode=sm.is_developer_mode(),
            active_storage=active_size,
            trash_storage=trash_size,
            total_storage=active_size + trash_size,
            integrity=IntegrityInfo(**integrity),
            features=registry.get_runtime_map(),
            bot=bot_info
        )
    )

@router.post("/features/{flag_name}", response_model=StructuredResponse[bool])
async def update_feature(
    flag_name: str,
    enabled: bool,
    sm: Annotated[SessionManager, Depends(get_session_manager)]
):
    """Updates a feature flag in the configuration."""
    sm.update_feature_flag(flag_name, enabled)
    return StructuredResponse(success=True, data=True)

@router.post("/config/bot-token", response_model=StructuredResponse[bool])
async def update_bot_token(
    token: str,
    sm: Annotated[SessionManager, Depends(get_session_manager)]
):
    """Updates the Telegram Bot Token."""
    config = sm.load_config()
    config["bot_token"] = token
    sm.save_config(config)
    
    from api.dependencies import _state
    if _state.bot_worker:
        try:
            await _state.bot_worker.stop()
        except Exception:
            pass
            
    return StructuredResponse(success=True, data=True)

@router.post("/config/bot-authorized-users", response_model=StructuredResponse[bool])
async def update_bot_authorized_users(
    users: str,
    sm: Annotated[SessionManager, Depends(get_session_manager)]
):
    """Updates the Authorized Telegram User IDs."""
    config = sm.load_config()
    
    user_ids = []
    if users.strip():
        raw_ids = users.replace(",", "\n").split("\n")
        for rid in raw_ids:
            rid = rid.strip()
            if not rid:
                continue
            if not rid.isdigit():
                raise HTTPException(status_code=400, detail=f"Invalid user ID: {rid}. Must be a numeric value.")
            user_ids.append(int(rid))
            
    config["bot_authorized_users"] = user_ids
    sm.save_config(config)
    
    from api.dependencies import _state
    if _state.bot_worker:
        try:
            await _state.bot_worker.stop()
        except Exception:
            pass
            
    return StructuredResponse(success=True, data=True)

@router.post("/rebuild", response_model=StructuredResponse[dict])
async def rebuild_index(
    manager: Annotated[TDriveManager, Depends(get_manager)],
    sm: Annotated[SessionManager, Depends(get_session_manager)],
    full: bool = False
):
    from core.recovery import RecoveryEngine
    engine = RecoveryEngine(manager.db_session, manager.tg_client, manager.channel_id, master_password=manager.master_password, session_manager=sm)
    stats = await engine.rebuild_index(full=full)
    
    if stats["errors"] > 0 and stats["recovered_chunks"] == 0:
        return StructuredResponse(
            success=False, 
            error={"code": "REBUILD_FAILED", "message": "Scan failed. This usually means your Master Password is not the same as when you uploaded the files."}
        )
        
    return StructuredResponse(success=True, data=stats)

@router.get("/audit", response_model=StructuredResponse[dict])
async def audit_integrity(
    manager: Annotated[TDriveManager, Depends(get_manager)],
    sm: Annotated[SessionManager, Depends(get_session_manager)]
):
    from core.recovery import RecoveryEngine
    engine = RecoveryEngine(manager.db_session, manager.tg_client, manager.channel_id, session_manager=sm)
    report = await engine.audit_integrity()
    return StructuredResponse(success=True, data=report)

@router.post("/cleanup", response_model=StructuredResponse[dict])
async def cleanup_system(
    background_tasks: BackgroundTasks,
    manager: Annotated[TDriveManager, Depends(get_manager)],
    sm: Annotated[SessionManager, Depends(get_session_manager)]
):
    """
    Deletes orphaned TDrive messages from Telegram in the background.
    """
    async def perform_cleanup(mgr: TDriveManager, s_mgr: SessionManager):
        from core.recovery import RecoveryEngine
        try:
            engine = RecoveryEngine(mgr.db_session, mgr.tg_client, mgr.channel_id, master_password=mgr.master_password, session_manager=s_mgr)
            deleted_count = await engine.cleanup_orphans()
            logging.info(f"Background cleanup completed: {deleted_count} orphans removed.")
        except Exception as e:
            logging.error(f"Background cleanup failed: {e}")

    background_tasks.add_task(perform_cleanup, manager, sm)
    return StructuredResponse(success=True, data={"message": "Cleanup process started in background"})

@router.post("/heal", response_model=StructuredResponse[dict])
async def heal_system_metadata(
    background_tasks: BackgroundTasks,
    manager: Annotated[TDriveManager, Depends(get_manager)],
    sm: Annotated[SessionManager, Depends(get_session_manager)]
):
    """
    Triggers a background scan to heal metadata and thumbnails for all files.
    """
    async def perform_heal(mgr: TDriveManager, cache_dir: Path, file_ids: list):
        count = 0
        for fid in file_ids:
            try:
                await mgr.get_preview_file(fid, cache_dir)
                count += 1
            except Exception as e:
                logging.error(f"Background healing failed for {fid}: {e}")
        logging.info(f"Background healing completed: {count} items processed.")

    to_heal_ids = []
    with manager.db_session.get_session() as session:
        from core.db.manager import DBManager
        db = DBManager(session)
        files = db.list_files(include_trashed=True)
        for f in files:
            if not f.is_folder and (not f.is_materialized or not f.thumbnail or f.sha256 in ["pending", "unknown", f.file_id]):
                to_heal_ids.append(f.file_id)
        
    if to_heal_ids:
        background_tasks.add_task(perform_heal, manager, sm.preview_cache_dir, to_heal_ids)
                
    return StructuredResponse(success=True, data={"healed_count": len(to_heal_ids), "message": "Healing process started in background"})

@router.post("/unlock", response_model=StructuredResponse[bool])
async def unlock_system(
    request: UnlockRequest,
    sm: Annotated[SessionManager, Depends(get_session_manager)]
):
    """Verifies the master password for elevated access."""
    is_valid = sm.verify_password(request.password)
    if not is_valid:
        return StructuredResponse(
            success=False, 
            error={"code": "INVALID_PASSWORD", "message": "Invalid master password."}
        )
    return StructuredResponse(success=True, data=True)

@router.get("/services", response_model=StructuredResponse[List[ServiceStatus]])
async def list_services(
    sm: Annotated[SessionManager, Depends(get_session_manager)]
):
    """Lists all systemd services and their current status."""
    try:
        config = sm.load_config()
        pinned_services = config.get("pinned_services", [])

        # Use systemctl to list all service units
        process = await asyncio.create_subprocess_exec(
            "systemctl", "list-units", "--type=service", "--all", "--no-legend", "--no-pager",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            return StructuredResponse(success=False, error={"code": "SYSTEMCTL_ERROR", "message": stderr.decode()})
            
        services = []
        lines = stdout.decode().strip().split('\n')
        for line in lines:
            parts = line.split(None, 4)
            if len(parts) >= 5:
                name = parts[0]
                services.append(ServiceStatus(
                    name=name,
                    load_state=parts[1],
                    active_state=parts[2],
                    sub_state=parts[3],
                    description=parts[4],
                    is_pinned=name in pinned_services
                ))
        return StructuredResponse(success=True, data=services)
    except Exception as e:
        return StructuredResponse(success=False, error={"code": "INTERNAL_ERROR", "message": str(e)})

@router.post("/services/{service_name}/pin", response_model=StructuredResponse[bool])
async def service_pin(
    service_name: str,
    pinned: bool,
    sm: Annotated[SessionManager, Depends(get_session_manager)]
):
    """Pins or unpins a systemd service in the dashboard."""
    try:
        config = sm.load_config()
        pinned_list = config.get("pinned_services", [])
        
        if pinned:
            if service_name not in pinned_list:
                pinned_list.append(service_name)
        else:
            if service_name in pinned_list:
                pinned_list.remove(service_name)
                
        config["pinned_services"] = pinned_list
        sm.save_config(config)
        return StructuredResponse(success=True, data=pinned)
    except Exception as e:
        return StructuredResponse(success=False, error={"code": "INTERNAL_ERROR", "message": str(e)})

@router.post("/services/{service_name}/action", response_model=StructuredResponse[bool])
async def service_action(service_name: str, request: ServiceActionRequest):
    """Performs an action (start, stop, restart, enable, disable) on a systemd service."""
    allowed_actions = ["start", "stop", "restart", "enable", "disable"]
    if request.action not in allowed_actions:
        raise HTTPException(status_code=400, detail="Invalid action")
        
    try:
        # Note: This requires sudo permissions without password for the user running the agent
        process = await asyncio.create_subprocess_exec(
            "sudo", "systemctl", request.action, service_name,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            return StructuredResponse(success=False, error={"code": "SYSTEMCTL_ERROR", "message": stderr.decode().strip()})
            
        return StructuredResponse(success=True, data=True)
    except Exception as e:
        return StructuredResponse(success=False, error={"code": "INTERNAL_ERROR", "message": str(e)})

@router.get("/services/{service_name}/logs", response_model=StructuredResponse[ServiceLogResponse])
async def get_service_logs(service_name: str, lines: int = 100):
    """Retrieves the recent logs for a specific systemd service."""
    try:
        process = await asyncio.create_subprocess_exec(
            "journalctl", "-u", service_name, "-n", str(lines), "--no-pager",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            return StructuredResponse(success=False, error={"code": "JOURNALCTL_ERROR", "message": stderr.decode().strip()})
            
        logs = stdout.decode().strip().split('\n')
        return StructuredResponse(success=True, data=ServiceLogResponse(service=service_name, logs=logs))
    except Exception as e:
        return StructuredResponse(success=False, error={"code": "INTERNAL_ERROR", "message": str(e)})
