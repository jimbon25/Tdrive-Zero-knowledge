"""
TDrive API Main Entry Point.
"""

import os
import sys
import time
import uuid
import logging
import asyncio
import platform
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, Request, status, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from api.routes import auth, files, system, jobs, developer, trash, bootstrap, analytics, duplicates
from api.schemas import StructuredResponse, ErrorDetail
from api.dependencies import close_tg_client, get_manager_by_ticket, validate_csrf, download_tickets, validate_integrity, _state
from core.manager import TDriveManager

# --- Event Loop Configuration ---
if platform.system() != "Windows":
    try:
        import uvloop
        asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
        logging.info("Using uvloop event loop policy.")
    except ImportError:
        logging.warning("uvloop not installed, using default asyncio loop.")

# --- Rate Limiting Setup ---
limiter = Limiter(key_func=get_remote_address)

async def trash_cleanup_worker():
    """Background worker to purge old trash items every 24 hours."""
    from core.session import SessionManager
    from api.dependencies import get_db_session
    from core.db.manager import DBManager
    from core.client import TDriveClient
    from core.integrity import IntegrityGuard
    
    RETENTION_DAYS = 30 
    sm = SessionManager()
    db_session_factory = get_db_session(sm)
    
    while True:
        try:
            from core.feature_registry import FeatureRegistry, FeatureID
            registry = FeatureRegistry(sm)
            
            # 0. Check Feature Toggle & Integrity
            if not registry.is_enabled(FeatureID.AUTO_TRASH_PURGE):
                logging.debug("TrashCleanupWorker: Feature disabled.")
                await asyncio.sleep(3600)
                continue
                
            guard = IntegrityGuard(sm)
            if guard.get_integrity_status()["safe_mode"]:
                logging.debug("TrashCleanupWorker: System in Safe Mode. Skipping purge.")
                await asyncio.sleep(3600)
                continue

            config = sm.load_config()
            
            retention = config.get("trash_retention_days", RETENTION_DAYS)
            if retention > 0:
                logging.info(f"Starting scheduled trash cleanup (Retention: {retention} days)")
                
                with db_session_factory.get_session() as session:
                    db = DBManager(session)
                    old_files = db.get_old_trashed_files(retention)
                    
                    if old_files:
                        logging.info(f"Found {len(old_files)} items to purge from trash.")
                        from api.dependencies import get_tg_client
                        tg = await get_tg_client(sm)
                        
                        manager = TDriveManager(
                            db_session_factory, 
                            tg, 
                            config["channel_id"], 
                            master_password="", 
                            master_salt=bytes.fromhex(config["master_salt"]),
                            upload_locks=_state.upload_locks
                        )
                        
                        for f in old_files:
                            try:
                                await manager.delete_file_permanently(f.file_id)
                                logging.info(f"Purged {f.filename} from trash automatically.")
                            except Exception as e:
                                logging.error(f"Failed to purge {f.filename}: {e}")
                                
            
        except Exception as e:
            logging.error(f"Trash cleanup worker error: {e}")
            
        await asyncio.sleep(86400)

async def preview_cache_cleanup_worker():
    """Background worker to purge old decrypted preview assets every 10 minutes."""
    from core.session import SessionManager
    from core.integrity import IntegrityGuard
    sm = SessionManager()
    while True:
        try:
            from core.feature_registry import FeatureRegistry, FeatureID
            registry = FeatureRegistry(sm)
            
            # 0. Check Integrity
            guard = IntegrityGuard(sm)
            if guard.get_integrity_status()["safe_mode"]:
                logging.debug("PreviewCacheWorker: System in Safe Mode. Skipping.")
                await asyncio.sleep(600)
                continue

            deleted = sm.cleanup_preview_cache(max_age_minutes=30)
            if deleted > 0:
                logging.info(f"Purged {deleted} old preview assets from cache.")
        except Exception as e:
            logging.error(f"Preview cache cleanup error: {e}")
        
        await asyncio.sleep(600) 

async def materialization_worker():
    """Background worker to finalize recovered files (thumbnails, hashes)."""
    from core.session import SessionManager
    from api.dependencies import get_db_session
    from core.db.manager import DBManager
    from core.client import TDriveClient
    from core.integrity import IntegrityGuard
    
    sm = SessionManager()
    db_session_factory = get_db_session(sm)

    while True:
        try:
            from core.feature_registry import FeatureRegistry, FeatureID
            registry = FeatureRegistry(sm)
            
            # 0. Check Feature Toggle & Integrity
            if not registry.is_enabled(FeatureID.BACKGROUND_MATERIALIZATION):
                logging.debug("MaterializationWorker: Feature disabled.")
                await asyncio.sleep(3600)
                continue
                
            guard = IntegrityGuard(sm)
            if guard.get_integrity_status()["safe_mode"]:
                logging.debug("MaterializationWorker: System in Safe Mode. Skipping.")
                await asyncio.sleep(3600)
                continue

            config = sm.load_config()
            if not config:
                await asyncio.sleep(10)
                continue
                
            with db_session_factory.get_session() as session:
                db = DBManager(session)
                pending_files = db.list_unmaterialized_files()
                pending_ids = [f.file_id for f in pending_files]
                
            if pending_ids:
                logging.info(f"MaterializationWorker: Processing {len(pending_ids)} recovered items.")
                from api.dependencies import get_tg_client
                tg = await get_tg_client(sm)
                
                # Use current master password if set in app state
                if _state.master_password:
                    manager = TDriveManager(
                        db_session_factory, 
                        tg, 
                        config["channel_id"], 
                        _state.master_password, 
                        bytes.fromhex(config["master_salt"]),
                        upload_locks=_state.upload_locks
                    )
                    
                    for fid in pending_ids:
                        try:
                            # 1. Use the preview cache to download the file
                            await manager.get_preview_file(fid, sm.preview_cache_dir)
                            logging.info(f"MaterializationWorker: Finalized item {fid}")
                        except Exception as e:
                            logging.error(f"MaterializationWorker: Failed to finalize {fid}: {e}")
                            
            
        except Exception as e:
            logging.error(f"Materialization worker error: {e}")
            
        await asyncio.sleep(60)

async def bot_worker():
    """Background worker to run the Telegram Bot interface."""
    from core.session import SessionManager
    from core.bot.worker import TDriveBotWorker
    
    while True:
        try:
            sm = SessionManager()
            _state.bot_worker = TDriveBotWorker(sm)
            await _state.bot_worker.start()
        except Exception as e:
            logging.error(f"Bot worker error: {e}")
        finally:
            _state.bot_worker = None
        
        await asyncio.sleep(30)

@asynccontextmanager
async def lifespan(app: FastAPI):
    from core.session import SessionManager
    try:
        sm = SessionManager()
        sm.cleanup_tmp()
        sm.cleanup_preview_cache(max_age_minutes=0) 
    except Exception:
        pass
    
    # 2. Job Recovery Worker
    from api.dependencies import get_db_session
    from core.db.manager import DBManager
    sm = SessionManager()
    
    config = sm.load_config()
    if config:
        db_session_factory = get_db_session(sm)
        db_session_factory.create_tables()
        
        with db_session_factory.get_session() as session:
            db = DBManager(session)
            stalled_jobs = db.list_jobs(status="running")
            for job in stalled_jobs:
                db.update_job_status(job.job_id, "failed", error="Process interrupted. Please retry.")

        # 3. Start Workers
        asyncio.create_task(trash_cleanup_worker())
        asyncio.create_task(preview_cache_cleanup_worker())
        asyncio.create_task(materialization_worker())
        asyncio.create_task(bot_worker())

    yield
    await close_tg_client()

app = FastAPI(
    title="TDrive API",
    description="Personal cloud storage with Telegram backend",
    version="1.4.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/download/{ticket}")
@limiter.limit("5/minute")
async def download_by_ticket(
    request: Request,
    ticket: str,
    manager: Annotated[TDriveManager, Depends(get_manager_by_ticket)]
):
    """Public streaming endpoint for downloads using a one-time ticket."""
    file_id = download_tickets.consume(ticket)
    if not file_id:
        return JSONResponse(
            status_code=403,
            content={"success": False, "error": {"code": "INVALID_TICKET", "message": "Ticket invalid or expired"}}
        )
    
    try:
        with manager.db_session.get_session() as session:
            from core.db.manager import DBManager
            from urllib.parse import quote
            db = DBManager(session)
            f_rec = db.get_file(file_id)
            filename = f_rec.filename if f_rec else "download.bin"
            
        encoded_filename = quote(filename)
        content_disposition = f'attachment; filename="{encoded_filename}"; filename*=UTF-8\'\'{encoded_filename}'

        return StreamingResponse(
            manager.download_file_stream(file_id),
            media_type="application/octet-stream",
            headers={"Content-Disposition": content_disposition}
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": {"code": "DOWNLOAD_FAILED", "message": str(e)}}
        )

@app.get("/api/v1/view/{ticket}")
async def view_by_ticket(
    request: Request,
    ticket: str,
    manager: Annotated[TDriveManager, Depends(get_manager_by_ticket)]
):
    """Authenticated previews using a one-time ticket."""
    file_id = download_tickets.consume(ticket)
    if not file_id:
        return JSONResponse(
            status_code=403,
            content={"success": False, "error": {"code": "INVALID_TICKET", "message": "Ticket invalid or expired"}}
        )
    
    from core.db.manager import DBManager
    from core.session import SessionManager
    from pathlib import Path
    import logging

    with manager.db_session.get_session() as session:
        db = DBManager(session)
        f_rec = db.get_file(file_id)
        if not f_rec:
            return JSONResponse(status_code=404, content={"success": False, "error": {"message": "File not found"}})
        
        filename = f_rec.filename
        ext = Path(filename.lower()).suffix
        size = f_rec.size

    # MIME Type Logic
    image_exts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]
    pdf_exts = [".pdf"]
    text_exts = [".txt", ".md", ".json", ".yaml", ".yml", ".log", ".csv"]

    mime_type = "application/octet-stream"
    if ext in image_exts:
        mime_type = f"image/{ext[1:]}" if ext != ".jpg" else "image/jpeg"
    elif ext in pdf_exts:
        mime_type = "application/pdf"
    elif ext in text_exts:
        mime_type = "text/plain"
        if size > 10 * 1024 * 1024:
             return JSONResponse(status_code=400, content={"success": False, "error": {"message": "File too large for preview"}})
    else:
        return JSONResponse(status_code=400, content={"success": False, "error": {"message": "Preview not supported"}})

    try:
        from api.routes.developer import preview_tracker
        preview_tracker.requests += 1

        sm = SessionManager()
        cache_path = await manager.get_preview_file(file_id, sm.preview_cache_dir)
        
        if cache_path.stat().st_mtime > (time.time() - 2): 
            preview_tracker.cache_misses += 1
        else:
            preview_tracker.cache_hits += 1

        from fastapi.responses import FileResponse
        return FileResponse(cache_path, media_type=mime_type)

    except Exception as e:
        err_msg = str(e)
        if "Decryption failed" in err_msg or "Invalid tag" in err_msg:
             return JSONResponse(
                 status_code=401, 
                 content={"success": False, "error": {"code": "INVALID_PASSWORD", "message": "Decryption failed. Your Master Password might be incorrect."}}
             )
        
        logging.error(f"View ticket failed: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"success": False, "error": {"message": err_msg}})

# Global Exception Handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=StructuredResponse(
            success=False,
            error=ErrorDetail(code=str(exc.status_code), message=exc.detail)
        ).model_dump()
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=StructuredResponse(
            success=False,
            error=ErrorDetail(code="INTERNAL_SERVER_ERROR", message="An unexpected error occurred")
        ).model_dump()
    )

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content=StructuredResponse(
            success=False,
            error=ErrorDetail(code="NOT_FOUND", message="The requested resource was not found")
        ).model_dump()
    )

# Include Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(bootstrap.router, prefix="/api/v1")
app.include_router(files.router, prefix="/api/v1", dependencies=[Depends(validate_csrf), Depends(validate_integrity)])
app.include_router(trash.router, prefix="/api/v1", dependencies=[Depends(validate_csrf), Depends(validate_integrity)])
app.include_router(system.router, prefix="/api/v1", dependencies=[Depends(validate_csrf), Depends(validate_integrity)])
app.include_router(jobs.router, prefix="/api/v1", dependencies=[Depends(validate_csrf), Depends(validate_integrity)])
app.include_router(developer.router, prefix="/api/v1", dependencies=[Depends(validate_csrf), Depends(validate_integrity)])
app.include_router(analytics.router, prefix="/api/v1", dependencies=[Depends(validate_csrf), Depends(validate_integrity)])
app.include_router(duplicates.router, prefix="/api/v1", dependencies=[Depends(validate_csrf), Depends(validate_integrity)])

@app.get("/")
async def root():
    return {"name": "TDrive API", "version": "1.4.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
