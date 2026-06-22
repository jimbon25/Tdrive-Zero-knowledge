"""
TDrive Database Manager.

High-level CRUD operations for managing files and chunks.
"""

from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy import select, delete, and_
from sqlalchemy.orm import Session

from core.db.models import ChunkModel, FileModel, JobModel, SettingModel


def split_virtual_path(path: str) -> tuple[str, str]:
    if not path or path == "/":
        return "/", ""
    if path.endswith("/") and len(path) > 1:
        path = path[:-1]
    idx = path.rfind("/")
    if idx == 0:
        return "/", path[1:]
    return path[:idx], path[idx+1:]


class DBError(Exception):
    """Base exception for database manager errors."""
    pass


class DBManager:
    """
    Handles higher-level database operations using provided sessions.
    """

    def __init__(self, session: Session):
        """
        Initializes the DBManager with a session.

        Args:
            session: An active SQLAlchemy Session.
        """
        self.session = session

    def create_file_record(
        self,
        file_id: str,
        filename: str,
        virtual_path: str,
        size: int,
        sha256: str,
        chunk_count: int,
        file_uuid: str,
        encrypted: bool = True,
        is_folder: bool = False,
        thumbnail: Optional[str] = None,
        storage_provider: Optional[str] = "telegram",
    ) -> FileModel:
        """Creates a new file record in the database."""
        file_record = FileModel(
            file_id=file_id,
            file_uuid=file_uuid,
            filename=filename,
            virtual_path=virtual_path,
            size=size,
            sha256=sha256,
            chunk_count=chunk_count,
            encrypted=encrypted,
            is_folder=is_folder,
            thumbnail=thumbnail,
            status="completed" if is_folder else "pending",
            storage_provider=storage_provider,
        )
        self.session.add(file_record)
        return file_record

    def create_folder(
        self,
        name: str,
        virtual_path: str,
        storage_provider: Optional[str] = "telegram"
    ) -> FileModel:
        """Creates a new folder record."""
        import uuid
        import hashlib
        folder_id = hashlib.sha256(f"folder:{virtual_path}/{name}:{uuid.uuid4()}".encode()).hexdigest()
        return self.create_file_record(
            file_id=folder_id,
            filename=name,
            virtual_path=virtual_path,
            size=0,
            sha256="none",
            chunk_count=0,
            file_uuid=uuid.uuid4().hex,
            is_folder=True,
            storage_provider=storage_provider
        )

    def update_file_status(self, file_id: str, status: str) -> None:
        """Updates the status of a file record."""
        file_record = self.get_file(file_id)
        if file_record:
            file_record.status = status
        else:
            raise DBError(f"File {file_id} not found.")

    def get_file(self, file_id: str) -> Optional[FileModel]:
        """Retrieves a file record by its ID."""
        return self.session.get(FileModel, file_id)

    def get_file_by_uuid(self, file_uuid: str) -> Optional[FileModel]:
        """Retrieves a file record by its UUID."""
        stmt = select(FileModel).where(FileModel.file_uuid == file_uuid)
        return self.session.execute(stmt).scalar_one_or_none()

    def list_files(self, virtual_path: Optional[str] = None, include_trashed: bool = False, provider: Optional[str] = None) -> List[FileModel]:
        """Lists all files/folders, filtered by path. Folders appear first."""
        from sqlalchemy import or_
        stmt = select(FileModel)
        if virtual_path:
            stmt = stmt.where(FileModel.virtual_path == virtual_path)
        
        if provider:
            if provider == "telegram":
                stmt = stmt.where(or_(FileModel.storage_provider == "telegram", FileModel.storage_provider == None, FileModel.storage_provider == ""))
            else:
                stmt = stmt.where(FileModel.storage_provider == provider)
        
        if not include_trashed:
            stmt = stmt.where(FileModel.is_trashed == False)
            
        stmt = stmt.order_by(FileModel.is_folder.desc(), FileModel.filename.asc())
        return list(self.session.execute(stmt).scalars().all())

    def list_trashed_files(self) -> List[FileModel]:
        """Lists all files currently in the trash."""
        stmt = select(FileModel).where(FileModel.is_trashed == True).order_by(FileModel.deleted_at.desc())
        return list(self.session.execute(stmt).scalars().all())

    def list_starred_files(self) -> List[FileModel]:
        """Lists all files marked as favorites."""
        stmt = select(FileModel).where(
            and_(
                FileModel.is_starred == True,
                FileModel.is_trashed == False
            )
        ).order_by(FileModel.is_folder.desc(), FileModel.filename.asc())
        return list(self.session.execute(stmt).scalars().all())

    def list_unmaterialized_files(self) -> List[FileModel]:
        """Lists files that require metadata healing (recovery items)."""
        stmt = select(FileModel).where(FileModel.is_materialized == False)
        return list(self.session.execute(stmt).scalars().all())

    def trash_file(self, file_id: str) -> bool:
        """Moves a file to trash (soft delete)."""
        f = self.get_file(file_id)
        if f:
            f.is_trashed = True
            f.deleted_at = datetime.now(timezone.utc)
            f.original_path = f.virtual_path
            return True
        return False

    def restore_file(self, file_id: str) -> bool:
        """Restores a file from trash."""
        f = self.get_file(file_id)
        if f and f.is_trashed:
            f.is_trashed = False
            f.deleted_at = None
            if f.original_path:
                f.virtual_path = f.original_path
            return True
        return False

    def star_file(self, file_id: str, starred: bool = True) -> bool:
        """Toggles the starred status of a file."""
        f = self.get_file(file_id)
        if f:
            f.is_starred = starred
            return True
        return False

    def delete_file_permanently(self, file_id: str) -> bool:
        """Deletes a file record and its associated chunks (cascade)."""
        file_record = self.get_file(file_id)
        if file_record:
            self.session.delete(file_record)
            return True
        return False

    def delete_file(self, file_id: str) -> bool:
        """Alias for delete_file_permanently."""
        return self.delete_file_permanently(file_id)

    def get_old_trashed_files(self, days: int) -> List[FileModel]:
        """Finds trashed files older than X days."""
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        stmt = select(FileModel).where(
            and_(
                FileModel.is_trashed == True,
                FileModel.deleted_at < cutoff
            )
        )
        return list(self.session.execute(stmt).scalars().all())

    def add_chunk(
        self,
        chunk_id: str,
        file_id: str,
        sequence: int,
        msg_id: int,
        channel_id: int,
        chunk_size: int,
        chunk_sha256: str,
    ) -> ChunkModel:
        """Adds a chunk record for a file."""
        chunk_record = ChunkModel(
            chunk_id=chunk_id,
            file_id=file_id,
            sequence=sequence,
            msg_id=msg_id,
            channel_id=channel_id,
            chunk_size=chunk_size,
            chunk_sha256=chunk_sha256,
        )
        self.session.add(chunk_record)
        return chunk_record

    def get_chunks(self, file_id: str) -> List[ChunkModel]:
        """Retrieves all chunks for a file, ordered by sequence."""
        stmt = select(ChunkModel).where(ChunkModel.file_id == file_id).order_by(ChunkModel.sequence)
        return list(self.session.execute(stmt).scalars().all())

    def file_exists(self, file_id: str) -> bool:
        """Checks if a file record exists."""
        return self.get_file(file_id) is not None

    # --- Job Operations ---

    def create_job(self, job_id: str, job_type: str, total_size: int = 0, file_id: Optional[str] = None) -> JobModel:
        """Creates a new background job."""
        job = JobModel(
            job_id=job_id,
            type=job_type,
            status="pending",
            total_size=total_size,
            file_id=file_id
        )
        self.session.add(job)
        return job

    def get_job(self, job_id: str) -> Optional[JobModel]:
        """Retrieves a job by ID."""
        return self.session.get(JobModel, job_id)

    def list_jobs(self, status: Optional[str] = None) -> List[JobModel]:
        """Lists all jobs, optionally filtered by status."""
        stmt = select(JobModel)
        if status:
            stmt = stmt.where(JobModel.status == status)
        stmt = stmt.order_by(JobModel.created_at.desc())
        return list(self.session.execute(stmt).scalars().all())

    def update_job_progress(self, job_id: str, current_size: int, progress: float) -> None:
        """Updates job progress and current size."""
        job = self.get_job(job_id)
        if job:
            job.current_size = current_size
            job.progress = progress

    def update_job_status(self, job_id: str, status: str, error: Optional[str] = None, file_id: Optional[str] = None) -> None:
        """Updates job status and optional error message."""
        job = self.get_job(job_id)
        if job:
            job.status = status
            if error:
                job.error = error
            if file_id:
                job.file_id = file_id

    def delete_job(self, job_id: str) -> bool:
        """Deletes a job record."""
        job = self.get_job(job_id)
        if job:
            self.session.delete(job)
            return True
        return False


    # --- Move Operations ---

    def move_file(self, file_id: str, new_path: str) -> bool:
        """Moves a file record to a new virtual path and updates its filename."""
        f = self.get_file(file_id)
        if not f:
            return False
            
        if not new_path.startswith("/"):
            new_path = "/" + new_path
            
        if new_path == "/":
            f.virtual_path = "/"
        else:
            dir_path, name = split_virtual_path(new_path)
            f.virtual_path = dir_path
            if name:
                f.filename = name
                
        return True

    def move_folder(self, file_id: str, new_path: str) -> bool:
        """Moves a folder record to a new virtual path and updates its name."""
        return self.move_file(file_id, new_path)

    def item_exists_in_destination(self, filename: str, destination: str) -> bool:
        """Checks if an active item with the same name exists in the destination."""
        dest = destination if destination else "/"
        stmt = select(FileModel).where(
            and_(
                FileModel.filename == filename,
                FileModel.virtual_path == dest,
                FileModel.is_trashed == False
            )
        )
        result = self.session.execute(stmt).scalars().first()
        return result is not None

    def get_children_by_path(self, path: str, include_trashed: bool = False) -> List[FileModel]:
        """Gets direct children of a folder path."""
        stmt = select(FileModel).where(FileModel.virtual_path == path)
        if not include_trashed:
            stmt = stmt.where(FileModel.is_trashed == False)
        return list(self.session.execute(stmt).scalars().all())

    def get_all_descendants(self, path: str, include_trashed: bool = False) -> List[FileModel]:
        """Gets all direct and nested descendants of a folder path."""
        stmt = select(FileModel).where(
            (FileModel.virtual_path == path) | (FileModel.virtual_path.like(path + "/%"))
        )
        if not include_trashed:
            stmt = stmt.where(FileModel.is_trashed == False)
        return list(self.session.execute(stmt).scalars().all())

    def list_folders(self) -> List[FileModel]:
        """Lists all folders that are not trashed."""
        stmt = select(FileModel).where(
            and_(
                FileModel.is_folder == True,
                FileModel.is_trashed == False
            )
        ).order_by(FileModel.virtual_path.asc(), FileModel.filename.asc())
        return list(self.session.execute(stmt).scalars().all())

    # --- Setting Operations ---

    def set_setting(self, key: str, value: str) -> None:
        """Sets or updates a persistent setting."""
        setting = self.session.get(SettingModel, key)
        if setting:
            setting.value = value
        else:
            self.session.add(SettingModel(key=key, value=value))

    def get_setting(self, key: str) -> Optional[str]:
        """Retrieves a setting value."""
        setting = self.session.get(SettingModel, key)
        return setting.value if setting else None
