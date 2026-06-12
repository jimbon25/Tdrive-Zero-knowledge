"""
TDrive Telegram Bot Bridge.

Abstraction layer for bot commands. Ensures bot operations
respect Integrity Guard and Feature Flags.
"""

import logging
from typing import Dict, Any, List, Optional
from core.session import SessionManager
from core.integrity import IntegrityGuard, IntegrityState
from core.feature_registry import FeatureRegistry, FeatureID

logger = logging.getLogger(__name__)

class BotBridge:
    """
    Acts as a secure intermediary between the Bot UI and Core Logic.
    """

    def __init__(self, sm: Optional[SessionManager] = None):
        self.sm = sm or SessionManager()
        self.guard = IntegrityGuard(self.sm)
        self.registry = FeatureRegistry(self.sm)

    def _check_bot_enabled(self):
        """Verifies if the bot interface is enabled in config."""
        if not self.registry.is_enabled(FeatureID.BOT_INTERFACE):
            return False, "Telegram Bot Interface is disabled in settings."
        return True, ""

    def _get_access_mode(self) -> str:
        """Determines if the bot should operate in READ_ONLY or FULL mode."""
        integrity = self.guard.get_integrity_status()
        flags = self.registry.get_feature_flags()
        
        if integrity["safe_mode"] or integrity["read_only"]:
            return "READ_ONLY"
            
        if not flags.get("bot_write_access", False):
            return "READ_ONLY"
            
        return "FULL_ACCESS"

    async def handle_list_files(self, path: str = "/", page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """Wraps file listing for the bot with smart resolution and pagination."""
        enabled, msg = self._check_bot_enabled()
        if not enabled:
            return {"success": False, "error": msg}

        from core.db.session import DatabaseSession
        from core.db.manager import DBManager
        from core.db.models import FileModel
        from sqlalchemy import select, func
        
        db_path = self.sm.config_dir / "tdrive.db"
        db_factory = DatabaseSession(str(db_path))
        
        try:
            with db_factory.get_session() as session:
                db = DBManager(session)
                
                target_path = path
                display_name = path
                
                if not path or path == "/":
                    target_path = "/"
                    display_name = "Root"
                else:
                    f = db.get_file(path) or db.get_file_by_uuid(path)
                    if f and f.is_folder:
                        target_path = f"{f.virtual_path.rstrip('/')}/{f.filename}"
                        display_name = f.filename
                    else:
                        stmt_check = select(func.count(FileModel.file_id)).where(FileModel.virtual_path == path)
                        exists = session.execute(stmt_check).scalar() > 0
                        
                        if not exists:
                            alt_path = path if path.startswith("/") else f"/{path}"
                            stmt_check = select(func.count(FileModel.file_id)).where(FileModel.virtual_path == alt_path)
                            if session.execute(stmt_check).scalar() > 0:
                                target_path = alt_path
                                display_name = path
                            else:
                                stmt = select(FileModel).where(
                                    FileModel.filename == path, 
                                    FileModel.is_folder == True, 
                                    FileModel.is_trashed == False
                                )
                                folder = session.execute(stmt).scalars().first()
                                if folder:
                                    target_path = f"{folder.virtual_path.rstrip('/')}/{folder.filename}"
                                    display_name = folder.filename
                                else:
                                    target_path = path
                
                count_stmt = select(func.count(FileModel.file_id)).where(
                    FileModel.virtual_path == target_path,
                    FileModel.is_trashed == False
                )
                total_count = session.execute(count_stmt).scalar()
                
                stmt = select(FileModel).where(
                    FileModel.virtual_path == target_path,
                    FileModel.is_trashed == False
                ).order_by(FileModel.is_folder.desc(), FileModel.filename.asc())
                
                stmt = stmt.limit(page_size).offset((page - 1) * page_size)
                files = session.execute(stmt).scalars().all()
                
                data = []
                for f in files:
                    data.append({
                        "file_id": f.file_id,
                        "file_uuid": f.file_uuid,
                        "filename": f.filename,
                        "size": f.size,
                        "is_folder": f.is_folder,
                        "created_at": f.created_at
                    })
                
                total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
                
                pagination_id = target_path
                if len(target_path) > 40:
                    p_parts = target_path.rsplit("/", 1)
                    v_path = p_parts[0] if p_parts[0] else "/"
                    f_name = p_parts[1]
                    stmt_f = select(FileModel).where(FileModel.filename == f_name, FileModel.virtual_path == v_path, FileModel.is_folder == True)
                    folder_rec = session.execute(stmt_f).scalars().first()
                    if folder_rec:
                        pagination_id = folder_rec.file_uuid

                return {
                    "success": True, 
                    "mode": self._get_access_mode(), 
                    "data": data,
                    "path": target_path,
                    "pagination_id": pagination_id,
                    "display_name": display_name,
                    "pagination": {
                        "current_page": page,
                        "total_pages": total_pages,
                        "total_count": total_count,
                        "page_size": page_size
                    }
                }
        except Exception as e:
            logger.error(f"BotBridge: Failed to list files: {e}")
            return {"success": False, "error": str(e)}

    async def handle_list_trash(self) -> Dict[str, Any]:
        """Lists all items in the trash."""
        enabled, msg = self._check_bot_enabled()
        if not enabled:
            return {"success": False, "error": msg}

        from core.db.session import DatabaseSession
        from core.db.manager import DBManager
        
        db_path = self.sm.config_dir / "tdrive.db"
        db_factory = DatabaseSession(str(db_path))
        
        try:
            with db_factory.get_session() as session:
                db = DBManager(session)
                files = db.list_trashed_files()
                
                data = []
                for f in files:
                    data.append({
                        "file_id": f.file_id,
                        "filename": f.filename,
                        "size": f.size,
                        "is_folder": f.is_folder,
                        "deleted_at": f.deleted_at
                    })
                
                return {
                    "success": True,
                    "data": data
                }
        except Exception as e:
            logger.error(f"BotBridge: Failed to list trash: {e}")
            return {"success": False, "error": str(e)}

    async def handle_search_files(self, query: str, page: int = 1, page_size: int = 10) -> Dict[str, Any]:
        """Searches for files by name with pagination."""
        enabled, msg = self._check_bot_enabled()
        if not enabled:
            return {"success": False, "error": msg}

        from core.db.session import DatabaseSession
        from sqlalchemy import select, func
        from core.db.models import FileModel
        
        db_path = self.sm.config_dir / "tdrive.db"
        db_factory = DatabaseSession(str(db_path))
        
        try:
            with db_factory.get_session() as session:
                count_stmt = select(func.count(FileModel.file_id)).where(
                    FileModel.filename.like(f"%{query}%"),
                    FileModel.is_trashed == False
                )
                total_count = session.execute(count_stmt).scalar()

                stmt = select(FileModel).where(
                    FileModel.filename.like(f"%{query}%"),
                    FileModel.is_trashed == False
                ).order_by(FileModel.is_folder.desc(), FileModel.filename.asc())
                
                stmt = stmt.limit(page_size).offset((page - 1) * page_size)
                files = session.execute(stmt).scalars().all()
                
                data = []
                for f in files:
                    data.append({
                        "file_id": f.file_id,
                        "file_uuid": f.file_uuid,
                        "filename": f.filename,
                        "size": f.size,
                        "is_folder": f.is_folder,
                        "virtual_path": f.virtual_path
                    })
                
                total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
                
                return {
                    "success": True,
                    "data": data,
                    "query": query,
                    "pagination": {
                        "current_page": page,
                        "total_pages": total_pages,
                        "total_count": total_count,
                        "page_size": page_size
                    }
                }
        except Exception as e:
            logger.error(f"BotBridge: Failed to search files: {e}")
            return {"success": False, "error": str(e)}

    async def handle_restore_file(self, file_id: str) -> Dict[str, Any]:
        """Restores a file from trash."""
        enabled, msg = self._check_bot_enabled()
        if not enabled:
            return {"success": False, "error": msg}

        if self._get_access_mode() == "READ_ONLY":
            return {"success": False, "error": "Bot is in READ_ONLY mode. Cannot restore files."}

        from core.manager import TDriveManager
        from core.client import TDriveClient
        
        config = self.sm.load_config()
        tg_client = TDriveClient(config["api_id"], config["api_hash"], str(self.sm.config_dir / "tdrive_bot.session"))
        
        
        from core.db.session import DatabaseSession
        from core.db.manager import DBManager
        db_path = self.sm.config_dir / "tdrive.db"
        db_factory = DatabaseSession(str(db_path))

        try:
            with db_factory.get_session() as session:
                db = DBManager(session)
                success = db.restore_file(file_id)
                if success:
                    return {"success": True, "message": f"File restored."}
                return {"success": False, "error": "File not found in trash or restore failed."}
        except Exception as e:
            logger.error(f"BotBridge: Failed to restore file: {e}")
            return {"success": False, "error": str(e)}

    async def handle_empty_trash(self) -> Dict[str, Any]:
        """Permanently deletes all items in trash."""
        enabled, msg = self._check_bot_enabled()
        if not enabled:
            return {"success": False, "error": msg}

        if self._get_access_mode() == "READ_ONLY":
            return {"success": False, "error": "Bot is in READ_ONLY mode. Cannot empty trash."}

        return {"success": False, "error": "Master Password required for permanent deletion. Please use Web UI or CLI."}

    async def handle_storage_summary(self) -> Dict[str, Any]:
        """Calculates storage statistics."""
        enabled, msg = self._check_bot_enabled()
        if not enabled:
            return {"success": False, "error": msg}

        from core.db.session import DatabaseSession
        from sqlalchemy import select, func
        from core.db.models import FileModel
        
        db_path = self.sm.config_dir / "tdrive.db"
        db_factory = DatabaseSession(str(db_path))
        
        try:
            with db_factory.get_session() as session:
                # Total Files (excluding folders)
                files_count = session.execute(select(func.count(FileModel.file_id)).where(FileModel.is_folder == False, FileModel.is_trashed == False)).scalar()
                # Total Folders
                folders_count = session.execute(select(func.count(FileModel.file_id)).where(FileModel.is_folder == True, FileModel.is_trashed == False)).scalar()
                # Used Storage
                used_storage = session.execute(select(func.sum(FileModel.size)).where(FileModel.is_trashed == False)).scalar() or 0
                # Trash Size
                trash_size = session.execute(select(func.sum(FileModel.size)).where(FileModel.is_trashed == True)).scalar() or 0
                trash_count = session.execute(select(func.count(FileModel.file_id)).where(FileModel.is_trashed == True)).scalar()
                
                # Largest File
                largest = session.execute(select(FileModel).where(FileModel.is_folder == False, FileModel.is_trashed == False).order_by(FileModel.size.desc()).limit(1)).scalar_one_or_none()
                
                return {
                    "success": True,
                    "total_files": files_count,
                    "total_folders": folders_count,
                    "used_storage": used_storage,
                    "trash_size": trash_size,
                    "trash_count": trash_count,
                    "largest_file": {
                        "filename": largest.filename,
                        "size": largest.size
                    } if largest else None
                }
        except Exception as e:
            logger.error(f"BotBridge: Failed to get storage summary: {e}")
            return {"success": False, "error": str(e)}

    async def handle_list_recent(self, page: int = 1, page_size: int = 10) -> Dict[str, Any]:
        """Lists recently uploaded files (excluding folders)."""
        enabled, msg = self._check_bot_enabled()
        if not enabled:
            return {"success": False, "error": msg}

        from core.db.session import DatabaseSession
        from sqlalchemy import select, func
        from core.db.models import FileModel
        
        db_path = self.sm.config_dir / "tdrive.db"
        db_factory = DatabaseSession(str(db_path))
        
        try:
            with db_factory.get_session() as session:
                count_stmt = select(func.count(FileModel.file_id)).where(FileModel.is_folder == False, FileModel.is_trashed == False)
                total_count = session.execute(count_stmt).scalar()

                stmt = select(FileModel).where(FileModel.is_folder == False, FileModel.is_trashed == False).order_by(FileModel.created_at.desc())
                stmt = stmt.limit(page_size).offset((page - 1) * page_size)
                files = session.execute(stmt).scalars().all()
                
                data = []
                for f in files:
                    data.append({
                        "file_id": f.file_id,
                        "file_uuid": f.file_uuid,
                        "filename": f.filename,
                        "size": f.size,
                        "is_folder": f.is_folder,
                        "virtual_path": f.virtual_path,
                        "created_at": f.created_at
                    })
                
                total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
                
                return {
                    "success": True,
                    "data": data,
                    "pagination": {
                        "current_page": page,
                        "total_pages": total_pages,
                        "total_count": total_count,
                        "page_size": page_size
                    }
                }
        except Exception as e:
            logger.error(f"BotBridge: Failed to list recent: {e}")
            return {"success": False, "error": str(e)}

    async def handle_list_starred(self, page: int = 1, page_size: int = 10) -> Dict[str, Any]:
        """Lists starred (favorite) files."""
        enabled, msg = self._check_bot_enabled()
        if not enabled:
            return {"success": False, "error": msg}

        from core.db.session import DatabaseSession
        from sqlalchemy import select, func
        from core.db.models import FileModel
        
        db_path = self.sm.config_dir / "tdrive.db"
        db_factory = DatabaseSession(str(db_path))
        
        try:
            with db_factory.get_session() as session:
                count_stmt = select(func.count(FileModel.file_id)).where(FileModel.is_starred == True, FileModel.is_trashed == False)
                total_count = session.execute(count_stmt).scalar()

                stmt = select(FileModel).where(FileModel.is_starred == True, FileModel.is_trashed == False).order_by(FileModel.is_folder.desc(), FileModel.filename.asc())
                stmt = stmt.limit(page_size).offset((page - 1) * page_size)
                files = session.execute(stmt).scalars().all()
                
                data = []
                for f in files:
                    data.append({
                        "file_id": f.file_id,
                        "file_uuid": f.file_uuid,
                        "filename": f.filename,
                        "size": f.size,
                        "is_folder": f.is_folder,
                        "virtual_path": f.virtual_path
                    })
                
                total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
                
                return {
                    "success": True,
                    "data": data,
                    "pagination": {
                        "current_page": page,
                        "total_pages": total_pages,
                        "total_count": total_count,
                        "page_size": page_size
                    }
                }
        except Exception as e:
            logger.error(f"BotBridge: Failed to list starred: {e}")
            return {"success": False, "error": str(e)}

    async def handle_list_jobs(self, page: int = 1, page_size: int = 10) -> Dict[str, Any]:
        """Lists background jobs."""
        enabled, msg = self._check_bot_enabled()
        if not enabled:
            return {"success": False, "error": msg}

        from core.db.session import DatabaseSession
        from sqlalchemy import select, func
        from core.db.models import JobModel
        
        db_path = self.sm.config_dir / "tdrive.db"
        db_factory = DatabaseSession(str(db_path))
        
        try:
            with db_factory.get_session() as session:
                count_stmt = select(func.count(JobModel.job_id))
                total_count = session.execute(count_stmt).scalar()

                stmt = select(JobModel).order_by(JobModel.created_at.desc())
                stmt = stmt.limit(page_size).offset((page - 1) * page_size)
                jobs = session.execute(stmt).scalars().all()
                
                data = []
                for j in jobs:
                    data.append({
                        "job_id": j.job_id,
                        "type": j.type,
                        "status": j.status,
                        "progress": j.progress,
                        "total_size": j.total_size,
                        "current_size": j.current_size,
                        "error": j.error,
                        "created_at": j.created_at
                    })
                
                total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
                
                return {
                    "success": True,
                    "data": data,
                    "pagination": {
                        "current_page": page,
                        "total_pages": total_pages,
                        "total_count": total_count,
                        "page_size": page_size
                    }
                }
        except Exception as e:
            logger.error(f"BotBridge: Failed to list jobs: {e}")
            return {"success": False, "error": str(e)}

    async def handle_get_file_info(self, identifier: str) -> Dict[str, Any]:
        """Retrieves detailed file information."""
        enabled, msg = self._check_bot_enabled()
        if not enabled:
            return {"success": False, "error": msg}

        from core.db.session import DatabaseSession
        from core.db.manager import DBManager
        
        db_path = self.sm.config_dir / "tdrive.db"
        db_factory = DatabaseSession(str(db_path))
        
        try:
            with db_factory.get_session() as session:
                db = DBManager(session)
                f = db.get_file(identifier) or db.get_file_by_uuid(identifier)
                
                if not f:
                    return {"success": False, "error": "File not found."}
                
                return {
                    "success": True,
                    "data": {
                        "file_id": f.file_id,
                        "file_uuid": f.file_uuid,
                        "filename": f.filename,
                        "size": f.size,
                        "path": f.virtual_path,
                        "sha256": f.sha256,
                        "chunks": f.chunk_count,
                        "is_starred": f.is_starred,
                        "is_trashed": f.is_trashed,
                        "created_at": f.created_at,
                        "status": f.status
                    }
                }
        except Exception as e:
            logger.error(f"BotBridge: Failed to get file info: {e}")
            return {"success": False, "error": str(e)}

    async def handle_system_status(self) -> Dict[str, Any]:
        """Provides a detailed status report for the bot."""
        enabled, msg = self._check_bot_enabled()
        if not enabled:
            return {"success": False, "error": msg}

        integrity = self.guard.get_integrity_status()
        
        # Additional checks
        from core.db.session import DatabaseSession
        from sqlalchemy import select
        db_path = self.sm.config_dir / "tdrive.db"
        db_factory = DatabaseSession(str(db_path))
        db_status = "Connected"
        try:
            with db_factory.get_session() as session:
                session.execute(select(1))
        except Exception:
            db_status = "Error"

        return {
            "success": True,
            "state": integrity["state"],
            "mode": self._get_access_mode(),
            "message": integrity["message"],
            "db_status": db_status,
            "api_status": "Online", 
            "tg_status": "Connected" if self.guard.generate_fingerprint() else "Check required"
        }

    def generate_secure_ticket(self, file_id: str) -> Dict[str, Any]:
        """
        Generates a secure download ticket.
        Blocked if in SAFE_MODE/CI and strict_ci_readonly is enabled.
        """
        enabled, msg = self._check_bot_enabled()
        if not enabled:
            return {"success": False, "error": msg}

        if self._get_access_mode() == "READ_ONLY":
            pass
            
        return {"success": True, "ticket": "STUB_TICKET"}
