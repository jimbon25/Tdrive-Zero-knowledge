"""
TDrive Duplicate Detection & Storage Cleanup Routes.
"""

from typing import Annotated, List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from api.dependencies import get_db_session, get_manager, validate_csrf
from api.schemas import (
    StructuredResponse,
    DuplicateSummarySchema,
    DuplicateGroupSchema,
    DuplicateCleanupRequest,
    FileSchema
)
from core.db.models import FileModel
from core.db.session import DatabaseSession
from core.manager import TDriveManager, ManagerError
from sqlalchemy import func, select

router = APIRouter(prefix="/duplicates", tags=["duplicates"])


def get_duplicate_groups_data(session) -> List[Dict[str, Any]]:
    """
    Finds and groups all active duplicate files by their SHA256 hashes.
    Uses indexing on sha256 to ensure performance.
    """
    # 1. Query to find duplicate sha256s (excluding folders, trashed files, and 'none')
    stmt = (
        select(FileModel.sha256)
        .where(
            FileModel.is_folder == False,
            FileModel.is_trashed == False,
            FileModel.sha256 != "none"
        )
        .group_by(FileModel.sha256)
        .having(func.count(FileModel.file_id) > 1)
    )
    duplicate_hashes = session.execute(stmt).scalars().all()
    
    if not duplicate_hashes:
        return []

    # 2. Get all files belonging to these duplicates
    files_stmt = (
        select(FileModel)
        .where(
            FileModel.sha256.in_(duplicate_hashes),
            FileModel.is_folder == False,
            FileModel.is_trashed == False
        )
        .order_by(FileModel.sha256, FileModel.created_at.desc())
    )
    duplicate_files = session.execute(files_stmt).scalars().all()

    # 3. Group files by sha256 in Python
    groups_dict = {}
    for f in duplicate_files:
        if f.sha256 not in groups_dict:
            groups_dict[f.sha256] = {
                "sha256": f.sha256,
                "size": f.size,
                "files": []
            }
        groups_dict[f.sha256]["files"].append(f)
        
    return list(groups_dict.values())


@router.get("/summary", response_model=StructuredResponse[DuplicateSummarySchema])
async def get_duplicates_summary(
    db_session: Annotated[DatabaseSession, Depends(get_db_session)]
):
    """
    Returns high-level stats about duplicate groups and files.
    """
    with db_session.get_session() as session:
        groups = get_duplicate_groups_data(session)
        
        duplicate_groups_count = len(groups)
        total_files_in_groups = sum(len(g["files"]) for g in groups)
        duplicate_files_count = sum(len(g["files"]) - 1 for g in groups)
        recoverable_size = sum(g["size"] * (len(g["files"]) - 1) for g in groups)
        
        return StructuredResponse(
            success=True,
            data=DuplicateSummarySchema(
                duplicate_groups_count=duplicate_groups_count,
                duplicate_files_count=duplicate_files_count,
                total_files_in_groups=total_files_in_groups,
                recoverable_size=recoverable_size
            )
        )


@router.get("/groups", response_model=StructuredResponse[List[DuplicateGroupSchema]])
async def get_duplicates_groups(
    db_session: Annotated[DatabaseSession, Depends(get_db_session)]
):
    """
    Lists all duplicate groups sorted by recoverable size descending.
    """
    with db_session.get_session() as session:
        groups = get_duplicate_groups_data(session)
        
        result = []
        for g in groups:
            result.append(
                DuplicateGroupSchema(
                    sha256=g["sha256"],
                    size=g["size"],
                    files=[FileSchema.model_validate(f) for f in g["files"]]
                )
            )
            
        result.sort(key=lambda x: x.size * (len(x.files) - 1), reverse=True)
        return StructuredResponse(success=True, data=result)


@router.post("/cleanup", response_model=StructuredResponse[int])
async def cleanup_duplicates(
    req: DuplicateCleanupRequest,
    db_session: Annotated[DatabaseSession, Depends(get_db_session)],
    manager: Annotated[TDriveManager, Depends(get_manager)]
):
    """
    Moves duplicate files to the trash bin according to the specified action.
    Never deletes files permanently. Returns the number of files successfully trashed.
    """
    trash_ids = []
    
    with db_session.get_session() as session:
        if req.action == "manual":
            if not req.file_ids:
                raise HTTPException(status_code=400, detail="file_ids list is required for manual cleanup")
            stmt = select(FileModel).where(
                FileModel.file_id.in_(req.file_ids),
                FileModel.is_folder == False,
                FileModel.is_trashed == False
            )
            files_to_trash = session.execute(stmt).scalars().all()
            trash_ids = [f.file_id for f in files_to_trash]
        else:
            groups = get_duplicate_groups_data(session)
            
            for g in groups:
                files = g["files"]
                if not files or len(files) <= 1:
                    continue
                
                if req.action == "keep_newest":
                    sorted_files = sorted(files, key=lambda x: x.created_at, reverse=True)
                    trash_ids.extend([f.file_id for f in sorted_files[1:]])
                    
                elif req.action == "keep_oldest":
                    sorted_files = sorted(files, key=lambda x: x.created_at)
                    trash_ids.extend([f.file_id for f in sorted_files[1:]])
                    
                elif req.action == "keep_starred":
                    starred = [f for f in files if f.is_starred]
                    if starred:
                        trash_ids.extend([f.file_id for f in files if not f.is_starred])
                    else:
                        sorted_files = sorted(files, key=lambda x: x.created_at, reverse=True)
                        trash_ids.extend([f.file_id for f in sorted_files[1:]])
                else:
                    raise HTTPException(status_code=400, detail=f"Invalid action: {req.action}")

    count = 0
    for fid in trash_ids:
        try:
            if await manager.trash_file(fid):
                count += 1
        except Exception:
            pass
            
    return StructuredResponse(success=True, data=count)
