"""
TDrive API Schemas.

Defines Pydantic models for request and response data.
"""

from datetime import datetime
from typing import List, Optional, Generic, TypeVar, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

T = TypeVar("T")

# --- Base Structured Response ---

class ErrorDetail(BaseModel):
    code: str
    message: str

class StructuredResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    error: Optional[ErrorDetail] = None

# --- Bootstrap Models ---

class BootstrapStatus(BaseModel):
    is_initialized: bool
    is_logged_in: bool
    has_master_password: bool
    config_path: str
    session_path: str

class InitRequest(BaseModel):
    api_id: int
    api_hash: str
    channel_id: int
    master_password: str

class TGSendCodeRequest(BaseModel):
    phone: str

class TGVerifyCodeRequest(BaseModel):
    phone: str
    code: str
    phone_code_hash: str
    password: Optional[str] = None 

# --- Auth Models ---

class LoginRequest(BaseModel):
    password: str

class LoginResponse(BaseModel):
    access_token: str
    csrf_token: str
    token_type: str = "bearer"

class FolderCreateRequest(BaseModel):
    name: str
    vpath: str = "/"

class MoveItemSchema(BaseModel):
    file_id: str
    item_type: str

class MoveRequest(BaseModel):
    items: List[MoveItemSchema]
    destination: str

class BulkMoveRequest(BaseModel):
    item_ids: List[str]
    target_path: str

# --- File Models ---

class ChunkSchema(BaseModel):
    chunk_id: str
    sequence: int
    msg_id: int
    chunk_size: int
    chunk_sha256: str

class FileSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    file_id: str
    filename: str
    virtual_path: str
    size: int
    sha256: str
    chunk_count: int
    encrypted: bool
    is_folder: bool
    is_starred: bool
    is_trashed: bool
    thumbnail: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    original_path: Optional[str] = None

class FileDetailSchema(FileSchema):
    chunks: List[ChunkSchema]

# --- System Models ---

class IntegrityInfo(BaseModel):
    state: str
    safe_mode: bool
    read_only: bool
    message: str

class BotInfo(BaseModel):
    is_active: bool
    username: Optional[str] = None

class SystemStatus(BaseModel):
    telegram_connected: bool
    sqlite_healthy: bool
    session_valid: bool
    config_exists: bool
    channel_accessible: bool
    upload_queue_size: int = 0
    dev_mode: bool = False
    active_storage: int = 0
    trash_storage: int = 0
    total_storage: int = 0
    integrity: Optional[IntegrityInfo] = None
    bot: Optional[BotInfo] = None
    features: Optional[Dict[str, List[Dict[str, Any]]]] = None

# --- Bulk Models ---

class BulkActionRequest(BaseModel):
    file_ids: List[str]

class JobSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    job_id: str
    type: str
    status: str
    progress: float
    total_size: int
    current_size: int
    file_id: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

# --- Analytics Models ---

class StorageOverview(BaseModel):
    total_files: int
    total_size: int
    trash_size: int
    estimated_capacity: int  

class FileTypeStats(BaseModel):
    category: str
    count: int
    size: int
    percentage: float

class FolderAnalytics(BaseModel):
    path: str
    total_files: int
    total_size: int

class GrowthMetrics(BaseModel):
    today: int
    last_7_days: int
    last_30_days: int

# --- Duplicate Detection Models ---

class DuplicateGroupSchema(BaseModel):
    sha256: str
    size: int
    files: List[FileSchema]

class DuplicateSummarySchema(BaseModel):
    duplicate_groups_count: int
    duplicate_files_count: int
    total_files_in_groups: int
    recoverable_size: int

class DuplicateCleanupRequest(BaseModel):
    action: str 
    file_ids: Optional[List[str]] = None

