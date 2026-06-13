"""
TDrive System Routes.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from api.dependencies import get_manager, get_session_manager, validate_csrf
from api.schemas import SystemStatus, StructuredResponse, IntegrityInfo
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

    # Bot Status
    from api.dependencies import _state
    bot_info = None
    config = sm.load_config()
    auth_users = config.get("bot_authorized_users", [])
    if _state.bot_worker:
        from api.schemas import BotInfo
        bot_info = BotInfo(
            is_active=_state.bot_worker.is_connected(),
            username=_state.bot_worker.username,
            has_authorized_user=len(auth_users) > 0,
            authorized_users=auth_users
        )
    elif config.get("bot_token"):
        from api.schemas import BotInfo
        bot_info = BotInfo(
            is_active=False,
            username=None,
            has_authorized_user=len(auth_users) > 0,
            authorized_users=auth_users
        )

    return StructuredResponse(
        success=True,
        data=SystemStatus(
            telegram_connected=manager.tg_client.client.is_connected(),
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
    manager: Annotated[TDriveManager, Depends(get_manager)],
    sm: Annotated[SessionManager, Depends(get_session_manager)]
):
    from core.recovery import RecoveryEngine
    engine = RecoveryEngine(manager.db_session, manager.tg_client, manager.channel_id, master_password=manager.master_password, session_manager=sm)
    deleted_count = await engine.cleanup_orphans()
    return StructuredResponse(success=True, data={"deleted_count": deleted_count})

@router.post("/heal", response_model=StructuredResponse[dict])
async def heal_system_metadata(
    manager: Annotated[TDriveManager, Depends(get_manager)],
    sm: Annotated[SessionManager, Depends(get_session_manager)]
):
    """
    Triggers a background scan to heal metadata and thumbnails for all files.
    """
    to_heal_ids = []
    with manager.db_session.get_session() as session:
        from core.db.manager import DBManager
        db = DBManager(session)
        files = db.list_files(include_trashed=True)
        for f in files:
            if not f.is_folder and (not f.is_materialized or not f.thumbnail or f.sha256 in ["pending", "unknown", f.file_id]):
                to_heal_ids.append(f.file_id)
        
    count = 0
    for fid in to_heal_ids:
        try:
            await manager.get_preview_file(fid, sm.preview_cache_dir)
            count += 1
        except Exception as e:
            logging.error(f"Manual healing failed for {fid}: {e}")
                
    return StructuredResponse(success=True, data={"healed_count": count})
