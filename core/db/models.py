"""
TDrive Database Models.

Defines the SQLAlchemy models for files and their associated chunks.
"""

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


class FileModel(Base):
    """
    Represents a file stored in TDrive.
    """
    __tablename__ = "files"

    file_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    file_uuid: Mapped[str] = mapped_column(String(36), unique=True, nullable=False) 
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    virtual_path: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False)
    encrypted: Mapped[bool] = mapped_column(Boolean, default=True)
    is_folder: Mapped[bool] = mapped_column(Boolean, default=False)
    thumbnail: Mapped[Optional[str]] = mapped_column(Text, nullable=True) 
    status: Mapped[str] = mapped_column(String(20), default="pending")
    sync_status: Mapped[str] = mapped_column(String(20), default="synced") 
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_trashed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    original_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_materialized: Mapped[bool] = mapped_column(Boolean, default=True)
    storage_provider: Mapped[Optional[str]] = mapped_column(String(50), default="telegram", nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    chunks: Mapped[List["ChunkModel"]] = relationship(
        "ChunkModel", back_populates="file", cascade="all, delete-orphan", order_by="ChunkModel.sequence"
    )

    def __repr__(self) -> str:
        return f"<File(filename='{self.filename}', status='{self.status}')>"


class SettingModel(Base):
    """
    Persistent application settings and recovery state.
    """
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text)

    def __repr__(self) -> str:
        return f"<Setting(key='{self.key}', value='{self.value}')>"


class ChunkModel(Base):
    """
    Represents an encrypted chunk of a file stored on Telegram.
    """
    __tablename__ = "chunks"
    __table_args__ = (
        UniqueConstraint("file_id", "sequence", name="uq_chunk_file_sequence"),
    )

    chunk_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    file_id: Mapped[str] = mapped_column(String(64), ForeignKey("files.file_id", ondelete="CASCADE"), nullable=False, index=True)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    msg_id: Mapped[int] = mapped_column(Integer, nullable=False)
    channel_id: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_size: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_sha256: Mapped[str] = mapped_column(String(64), nullable=False)

    file: Mapped["FileModel"] = relationship("FileModel", back_populates="chunks")

    def __repr__(self) -> str:
        return f"<Chunk(file_id='{self.file_id}', sequence={self.sequence}, msg_id={self.msg_id})>"


class JobModel(Base):
    """
    Represents an asynchronous background task (upload/download).
    """
    __tablename__ = "jobs"

    job_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    type: Mapped[str] = mapped_column(String(20))  
    status: Mapped[str] = mapped_column(String(20), default="pending")  
    progress: Mapped[float] = mapped_column(Integer, default=0)
    total_size: Mapped[int] = mapped_column(Integer, default=0)
    current_size: Mapped[int] = mapped_column(Integer, default=0)
    file_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def __repr__(self) -> str:
        return f"<Job(job_id='{self.job_id}', type='{self.type}', status='{self.status}')>"
