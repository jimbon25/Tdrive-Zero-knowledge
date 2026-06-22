"""
TDrive Orchestration Manager.

The central brain of TDrive. Manages the high-level workflows for uploading
and downloading files, handling encryption, chunking, and database persistence.
"""

import os
import base64
import json
import logging
import math
import uuid
import tempfile
import asyncio
import time
from pathlib import Path
from typing import Any, AsyncGenerator, Callable, List, Optional, Dict

from sqlalchemy import select, and_
from core.client import TDriveClient
from core.crypto import decrypt, derive_key, encrypt, CryptoError, sign_data, verify_signature
from core.db.manager import DBManager, DBError
from core.db.session import DatabaseSession
from core.utils import (
    chunk_file_iterator,
    get_bytes_sha256,
    get_file_sha256,
    get_file_size,
)

logger = logging.getLogger(__name__)

DEFAULT_CHUNK_SIZE = 20 * 1024 * 1024 


class ManagerError(Exception):
    """Base exception for Manager operations."""
    pass


class TDriveManager:
    """
    Orchestrates file operations between local storage, SQLite, and Telegram.
    """

    def __init__(
        self,
        db_session: DatabaseSession,
        tg_client: TDriveClient,
        channel_id: int,
        master_password: str,
        master_salt: bytes,
        upload_locks: Optional[Dict[str, asyncio.Lock]] = None
    ):
        """
        Initializes the TDriveManager.
        """
        self.db_session = db_session
        self.tg_client = tg_client
        self.channel_id = channel_id
        self.master_password = master_password
        self.master_salt = master_salt
        self.key = derive_key(master_password, master_salt)
        # Use provided shared locks or fall back to instance-local (for tests/CLI)
        self._upload_locks = upload_locks if upload_locks is not None else {}

    def _generate_metadata_tag(self, file_id: str, file_uuid: str, filename: str, sequence: int, total_chunks: int) -> str:
        """
        Generates a Base64-encoded compact JSON tag for Telegram captions.
        Includes an HMAC signature for integrity.
        """
        data = {
            "v": 1,
            "fid": file_id,
            "uuid": file_uuid,
            "seq": sequence,
            "tot": total_chunks,
            "name": filename,
            "salt": self.master_salt.hex()
        }
        json_bytes = json.dumps(data, separators=(",", ":")).encode()
        signature = sign_data(json_bytes, self.key)
        
        payload = bytes([len(signature)]) + signature + json_bytes
        return base64.b64encode(payload).decode()

    async def upload_file(
        self,
        local_path: str | Path,
        virtual_path: str = "/",
        progress_callback: Optional[Callable[[int, int], None]] = None,
        storage_provider: str = "telegram"
    ) -> str:
        """
        Uploads a file to Telegram in chunks, or delegates to OmniCloud.
        """
        path = Path(local_path)
        if not path.exists():
            raise ManagerError(f"File not found: {local_path}")

        file_size = get_file_size(path)
        file_sha256 = get_file_sha256(path)
        filename = path.name
        file_uuid = uuid.uuid4().hex

        # Check if already uploaded to omnicloud
        if storage_provider == "omnicloud":
            with self.db_session.get_session() as session:
                from core.db.models import FileModel
                from sqlalchemy import select
                stmt = select(FileModel).where(
                    FileModel.sha256 == file_sha256,
                    FileModel.storage_provider == "omnicloud",
                    FileModel.status == "completed"
                )
                existing = session.execute(stmt).scalars().first()
                if existing:
                    logger.info(f"File {filename} already fully uploaded to OmniCloud.")
                    return existing.file_id

            import httpx
            import mimetypes
            omnicloud_url = os.environ.get("OMNICLOUD_API_URL", "http://localhost:8787/api")
            bridge_secret = os.environ.get("INTERNAL_BRIDGE_SECRET", "omnicloud-dev-bridge-secret")
            mime_type = mimetypes.guess_type(path)[0] or "application/octet-stream"

            # 1. Initiate upload
            async with httpx.AsyncClient(timeout=30.0) as client:
                initiate_payload = {
                    "file_name": filename,
                    "size": file_size,
                    "mime_type": mime_type,
                    "virtual_path": virtual_path
                }
                resp = await client.post(
                    f"{omnicloud_url}/uploads/initiate",
                    json=initiate_payload,
                    headers={"X-Bridge-Secret": bridge_secret}
                )
                if resp.status_code != 201:
                    raise ManagerError(f"Failed to initiate OmniCloud upload: {resp.text}")
                
                upload_data = resp.json().get("data", {})
                upload_id = upload_data.get("upload_id")
                if not upload_id:
                    raise ManagerError(f"No upload ID returned from OmniCloud initiate: {resp.text}")

            # 2. Stream content
            async def file_generator():
                uploaded_bytes = 0
                with open(path, "rb") as f:
                    while True:
                        chunk = f.read(1024 * 1024)
                        if not chunk:
                            break
                        uploaded_bytes += len(chunk)
                        if progress_callback:
                            progress_callback(uploaded_bytes, file_size)
                        yield chunk

            async with httpx.AsyncClient(timeout=None) as client:
                resp = await client.post(
                    f"{omnicloud_url}/uploads/{upload_id}/stream",
                    content=file_generator(),
                    headers={
                        "X-Bridge-Secret": bridge_secret,
                        "Content-Type": "application/octet-stream"
                    }
                )
                if resp.status_code != 201:
                    raise ManagerError(f"Failed to stream OmniCloud upload: {resp.text}")
                
                remote_file = resp.json().get("data", {})
                remote_file_id = remote_file.get("id") or remote_file.get("remote_file_id")
                if not remote_file_id:
                    raise ManagerError("OmniCloud upload response missing remote file ID")

            # 3. Save File Record
            with self.db_session.get_session() as session:
                db = DBManager(session)
                db.create_file_record(
                    file_id=str(remote_file_id),
                    file_uuid=file_uuid,
                    filename=filename,
                    virtual_path=virtual_path,
                    size=file_size,
                    sha256=file_sha256,
                    chunk_count=1,
                    storage_provider="omnicloud"
                )
            return str(remote_file_id)

        # Telegram Upload Path
        file_id = file_sha256
        chunk_count = math.ceil(file_size / DEFAULT_CHUNK_SIZE) if file_size > 0 else 1
        file_uuid = uuid.uuid4().hex

        # Phase 1: Initialize or Resume File Record
        with self.db_session.get_session() as session:
            db = DBManager(session)
            file_record = db.get_file(file_id)

            if file_record and file_record.status == "completed":
                logger.info(f"File {filename} already fully uploaded.")
                return file_id

            if not file_record:
                file_record = db.create_file_record(
                    file_id=file_id,
                    file_uuid=file_uuid,
                    filename=filename,
                    virtual_path=virtual_path,
                    size=file_size,
                    sha256=file_sha256,
                    chunk_count=chunk_count
                )
            else:
                file_record.status = "uploading"
                file_uuid = file_record.file_uuid
            
            existing_chunks = {c.sequence for c in db.get_chunks(file_id)}

        # Phase 2: Upload Chunks
        lock = self._upload_locks.setdefault(file_id, asyncio.Lock())
            
        async with lock:
            try:
                # Refresh existing chunks within the lock to handle concurrent race
                with self.db_session.get_session() as session:
                    db = DBManager(session)
                    existing_chunks = {c.sequence for c in db.get_chunks(file_id)}

                for seq, chunk_data in enumerate(chunk_file_iterator(path, DEFAULT_CHUNK_SIZE)):
                    if seq in existing_chunks:
                        continue

                    # 1. Encrypt
                    nonce, ciphertext = encrypt(chunk_data, self.key)
                    encrypted_blob = nonce + ciphertext
                    chunk_sha256 = get_bytes_sha256(encrypted_blob)
                    
                    # 2. Upload
                    metadata = self._generate_metadata_tag(file_id, file_uuid, filename, seq, chunk_count)
                    caption = f"tdrive:{metadata}"
                    
                    try:
                        message = await self.tg_client.send_document(
                            self.channel_id,
                            encrypted_blob,
                            caption=caption
                        )
                    except Exception as e:
                        with self.db_session.get_session() as session:
                            db = DBManager(session)
                            db.update_file_status(file_id, "error")
                        raise ManagerError(f"Failed to upload chunk {seq}: {str(e)}")

                    # 3. Record Chunk in its own transaction
                    with self.db_session.get_session() as session:
                        db = DBManager(session)
                        db.add_chunk(
                            chunk_id=uuid.uuid4().hex,
                            file_id=file_id,
                            sequence=seq,
                            msg_id=message.id,
                            channel_id=self.channel_id,
                            chunk_size=len(encrypted_blob),
                            chunk_sha256=chunk_sha256
                        )

                    if progress_callback:
                        progress_callback(seq + 1, chunk_count)

                # Phase 3: Finalize
                with self.db_session.get_session() as session:
                    db = DBManager(session)
                    db.update_file_status(file_id, "completed")
            finally:
                # Cleanup registry if we were the last one using this lock
                # (Optional optimization: only pop if no one is waiting, but setdefault is safe)
                self._upload_locks.pop(file_id, None)
            
        return file_id

    async def download_file(
        self,
        file_id: str,
        output_path: str | Path,
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> Path:
        """
        Downloads a file from Telegram and assembles it locally.
        Uses the streaming generator internally.
        """
        out_path = Path(output_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)

        with open(out_path, "wb") as f:
            async for chunk_data in self.download_file_stream(file_id, progress_callback):
                f.write(chunk_data)

        with self.db_session.get_session() as session:
            db = DBManager(session)
            file_record = db.get_file(file_id)
            actual_sha256 = get_file_sha256(out_path)
            
            if file_record.sha256 in ["pending", "unknown", file_id]:
                file_record.sha256 = actual_sha256
            elif actual_sha256 != file_record.sha256:
                out_path.unlink()
                raise ManagerError(f"Final file integrity verification failed. Expected {file_record.sha256}, got {actual_sha256}")

        return out_path

    async def upload_file_stream(
        self,
        stream: Any,
        filename: str,
        total_size: int,
        virtual_path: str = "/",
        progress_callback: Optional[Callable[[int, int], None]] = None,
        storage_provider: str = "telegram"
    ) -> str:
        """
        Uploads a file by reading from a stream, or delegates to OmniCloud.
        """
        import hashlib
        file_uuid = uuid.uuid4().hex

        # Check if omnicloud
        if storage_provider == "omnicloud":
            import httpx
            import mimetypes
            omnicloud_url = os.environ.get("OMNICLOUD_API_URL", "http://localhost:8787/api")
            bridge_secret = os.environ.get("INTERNAL_BRIDGE_SECRET", "omnicloud-dev-bridge-secret")
            mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"

            # 1. Initiate upload
            async with httpx.AsyncClient(timeout=30.0) as client:
                initiate_payload = {
                    "file_name": filename,
                    "size": total_size,
                    "mime_type": mime_type,
                    "virtual_path": virtual_path
                }
                resp = await client.post(
                    f"{omnicloud_url}/uploads/initiate",
                    json=initiate_payload,
                    headers={"X-Bridge-Secret": bridge_secret}
                )
                if resp.status_code != 201:
                    raise ManagerError(f"Failed to initiate OmniCloud upload: {resp.text}")
                
                upload_data = resp.json().get("data", {})
                upload_id = upload_data.get("upload_id")
                if not upload_id:
                    raise ManagerError("No upload ID returned from OmniCloud initiate")

            # 2. Stream content from stream
            async def stream_generator():
                uploaded_bytes = 0
                while True:
                    if asyncio.iscoroutinefunction(stream.read):
                        chunk = await stream.read(128 * 1024)
                    else:
                        chunk = stream.read(128 * 1024)
                    if not chunk:
                        break
                    uploaded_bytes += len(chunk)
                    if progress_callback:
                        progress_callback(uploaded_bytes, total_size)
                    yield chunk

            async with httpx.AsyncClient(timeout=None) as client:
                resp = await client.post(
                    f"{omnicloud_url}/uploads/{upload_id}/stream",
                    content=stream_generator(),
                    headers={
                        "X-Bridge-Secret": bridge_secret,
                        "Content-Type": "application/octet-stream"
                    }
                )
                if resp.status_code != 201:
                    raise ManagerError(f"Failed to stream OmniCloud upload: {resp.text}")
                
                remote_file = resp.json().get("data", {})
                remote_file_id = remote_file.get("id") or remote_file.get("remote_file_id")
                if not remote_file_id:
                    raise ManagerError("OmniCloud upload response missing remote file ID")

            # 3. Save File Record
            with self.db_session.get_session() as session:
                db = DBManager(session)
                db.create_file_record(
                    file_id=str(remote_file_id),
                    file_uuid=file_uuid,
                    filename=filename,
                    virtual_path=virtual_path,
                    size=total_size,
                    sha256="unknown",
                    chunk_count=1,
                    storage_provider="omnicloud"
                )
            return str(remote_file_id)
        import hashlib
        temp_fid_content = f"{filename}:{total_size}:{time.time()}".encode()
        temp_fid = hashlib.sha256(temp_fid_content).hexdigest()
        file_uuid = uuid.uuid4().hex
        
        chunk_count = math.ceil(total_size / DEFAULT_CHUNK_SIZE) if total_size > 0 else 1
        
        # 1. Initialize record
        with self.db_session.get_session() as session:
            db = DBManager(session)
            file_record = db.create_file_record(
                file_id=temp_fid,
                file_uuid=file_uuid,
                filename=filename,
                virtual_path=virtual_path,
                size=total_size,
                sha256="pending", 
                chunk_count=chunk_count
            )
            file_record.status = "uploading"

        full_hash = hashlib.sha256()
        current_seq = 0
        
        # 2. Read stream in chunks
        lock = self._upload_locks.setdefault(temp_fid, asyncio.Lock())
        async with lock:
            try:
                while True:
                    if asyncio.iscoroutinefunction(stream.read):
                        chunk_data = await stream.read(DEFAULT_CHUNK_SIZE)
                    else:
                        chunk_data = stream.read(DEFAULT_CHUNK_SIZE)

                    if not chunk_data:
                        break
                    
                    full_hash.update(chunk_data)
                    
                    nonce, ciphertext = encrypt(chunk_data, self.key)
                    encrypted_blob = nonce + ciphertext
                    chunk_sha256 = get_bytes_sha256(encrypted_blob)
                    
                    metadata = self._generate_metadata_tag(temp_fid, file_uuid, filename, current_seq, chunk_count)
                    caption = f"tdrive:{metadata}"
                    
                    message = await self.tg_client.send_document(
                        self.channel_id,
                        encrypted_blob,
                        caption=caption
                    )
                    
                    with self.db_session.get_session() as session:
                        db = DBManager(session)
                        db.add_chunk(
                            chunk_id=uuid.uuid4().hex,
                            file_id=temp_fid,
                            sequence=current_seq,
                            msg_id=message.id,
                            channel_id=self.channel_id,
                            chunk_size=len(encrypted_blob),
                            chunk_sha256=chunk_sha256
                        )
                    
                    current_seq += 1
                    if progress_callback:
                        progress_callback(current_seq, chunk_count)

                final_sha256 = full_hash.hexdigest()
                
                with self.db_session.get_session() as session:
                    db = DBManager(session)
                    file_record = db.get_file(temp_fid)
                    if file_record:
                        file_record.sha256 = final_sha256
                        file_record.status = "completed"
                        
                return temp_fid
            except Exception as e:
                logger.error(f"Stream upload failed: {e}")
                with self.db_session.get_session() as session:
                    db = DBManager(session)
                    try:
                        db.update_file_status(temp_fid, "error")
                    except:
                        pass
                raise
            finally:
                self._upload_locks.pop(temp_fid, None)

    async def download_file_stream(
        self,
        file_id: str,
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> AsyncGenerator[bytes, None]:
        """
        Downloads chunks from Telegram or streams from OmniCloud, and yields bytes.
        No full file is stored on disk during this process.
        """
        # Phase 1: Load metadata
        with self.db_session.get_session() as session:
            db = DBManager(session)
            file_record = db.get_file(file_id)
            if not file_record:
                raise ManagerError(f"File {file_id} not found in database.")
            
            is_omnicloud = file_record.storage_provider == "omnicloud"
            expected_chunk_count = file_record.chunk_count
            chunks_data = []
            if not is_omnicloud:
                for c in db.get_chunks(file_id):
                    chunks_data.append({
                        "msg_id": c.msg_id,
                        "sha256": c.chunk_sha256,
                        "seq": c.sequence
                    })

        if is_omnicloud:
            import httpx
            omnicloud_url = os.environ.get("OMNICLOUD_API_URL", "http://localhost:8787/api")
            bridge_secret = os.environ.get("INTERNAL_BRIDGE_SECRET", "omnicloud-dev-bridge-secret")
            
            timeout = httpx.Timeout(60.0, read=30 * 60.0, write=30 * 60.0)
            bytes_yielded = 0
            
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    async with client.stream(
                        "GET",
                        f"{omnicloud_url}/files/{file_id}/download",
                        headers={"X-Bridge-Secret": bridge_secret}
                    ) as response:
                        if response.status_code != 200:
                            raise ManagerError(f"Failed to stream from OmniCloud: {response.status_code} - {response.reason_phrase}")
                        
                        async for chunk in response.aiter_bytes(chunk_size=8192):
                            if not chunk:
                                continue
                            bytes_yielded += len(chunk)
                            yield chunk
                            
                            if progress_callback:
                                estimated_chunks = max(1, bytes_yielded // (8192 * 20))
                                progress_callback(estimated_chunks, max(estimated_chunks, 1))
                        
                        logger.debug(f"OmniCloud download completed for {file_id}: {bytes_yielded} bytes")
            except httpx.TimeoutException as e:
                raise ManagerError(f"OmniCloud download timeout after {bytes_yielded} bytes: {str(e)}")
            except httpx.HTTPError as e:
                raise ManagerError(f"OmniCloud download HTTP error: {str(e)}")
            return

        if len(chunks_data) != expected_chunk_count:
            raise ManagerError(f"Missing chunks for file {file_id}. Expected {expected_chunk_count}, got {len(chunks_data)}.")

        # Phase 2: Stream chunks
        for i, chunk_info in enumerate(chunks_data):
            seq = chunk_info["seq"]
            msg_id = chunk_info["msg_id"]
            expected_chunk_sha = chunk_info["sha256"]

            # Use mkstemp and close handle immediately to avoid Windows sharing violations
            fd, tmp_name = tempfile.mkstemp(suffix=".chunk")
            os.close(fd)
            temp_chunk_path = Path(tmp_name)
            
            try:
                msg = await self.tg_client.get_message(self.channel_id, msg_id)
                if not msg:
                    raise ManagerError(f"Message {msg_id} not found on Telegram.")
                
                await self.tg_client.download_document(msg, temp_chunk_path)
                
                encrypted_data = temp_chunk_path.read_bytes()
                
                if expected_chunk_sha != "unknown":
                    if get_bytes_sha256(encrypted_data) != expected_chunk_sha:
                        raise ManagerError(f"Integrity failure for encrypted chunk {seq}.")
                else:
                    try:
                        actual_chunk_sha = get_bytes_sha256(encrypted_data)
                        with self.db_session.get_session() as session:
                            from core.db.models import ChunkModel
                            stmt = select(ChunkModel).where(and_(ChunkModel.file_id == file_id, ChunkModel.sequence == seq))
                            c_rec = session.execute(stmt).scalar_one_or_none()
                            if c_rec:
                                c_rec.chunk_sha256 = actual_chunk_sha
                    except Exception as e:
                        logger.debug(f"Failed to update recovered chunk hash: {e}")

                nonce = encrypted_data[:12]
                ciphertext = encrypted_data[12:]
                try:
                    decrypted_data = decrypt(nonce, ciphertext, self.key)
                except CryptoError as e:
                    raise ManagerError(f"Decryption failed for chunk {seq}: {str(e)}")

                yield decrypted_data

                if progress_callback:
                    progress_callback(i + 1, expected_chunk_count)
            finally:
                if temp_chunk_path.exists():
                    temp_chunk_path.unlink()

    async def trash_file(self, file_id: str) -> bool:
        """Moves a file to trash (soft delete)."""
        with self.db_session.get_session() as session:
            db = DBManager(session)
            return db.trash_file(file_id)

    async def restore_file(self, file_id: str) -> bool:
        """Restores a file from trash."""
        with self.db_session.get_session() as session:
            db = DBManager(session)
            return db.restore_file(file_id)

    async def delete_file_permanently(self, file_id: str) -> int:
        """
        Deletes a file from both Telegram and the local database permanently.
        Also purges decrypted preview cache.
        """
        with self.db_session.get_session() as session:
            db = DBManager(session)
            file_record = db.get_file(file_id)
            if not file_record:
                raise ManagerError(f"File {file_id} not found.")
            
            chunks = db.get_chunks(file_id)
            msg_ids = [c.msg_id for c in chunks]
            deleted_chunks_count = len(msg_ids)
            sha256 = file_record.sha256
            filename = file_record.filename

            # 1. Delete from Telegram or OmniCloud
            is_omnicloud = file_record.storage_provider == "omnicloud"
            if is_omnicloud:
                omnicloud_url = os.environ.get("OMNICLOUD_API_URL", "http://localhost:8787/api")
                bridge_secret = os.environ.get("INTERNAL_BRIDGE_SECRET", "omnicloud-dev-bridge-secret")
                try:
                    import httpx
                    async with httpx.AsyncClient() as client:
                        resp = await client.post(
                            f"{omnicloud_url}/files/bulk/delete",
                            json={"ids": [file_id]},
                            headers={"X-Bridge-Secret": bridge_secret}
                        )
                        if resp.status_code != 200:
                            logger.error(f"Failed to delete file from OmniCloud: {resp.text}")
                except Exception as e:
                    logger.error(f"Error calling OmniCloud delete API: {e}")
            elif msg_ids:
                try:
                    await self.tg_client.delete_messages(self.channel_id, msg_ids)
                except Exception as e:
                    logger.error(f"Failed to delete chunks from Telegram: {e}")

            # 2. Delete from Database
            db.delete_file_permanently(file_id)
            
            # 3. Purge Preview Cache
            try:
                from core.session import SessionManager
                sm = SessionManager()
                ext = Path(filename).suffix
                cache_file = sm.preview_cache_dir / f"{sha256}{ext}"
                if cache_file.exists():
                    cache_file.unlink()
                    logger.info(f"Purged preview cache for {filename}")
            except Exception as e:
                logger.error(f"Failed to purge preview cache: {e}")

            return deleted_chunks_count

    async def delete_file(self, file_id: str) -> bool:
        """
        Compatibility method. Now defaults to soft delete (trash).
        """
        return await self.trash_file(file_id)

    async def get_preview_file(self, file_id: str, cache_dir: Path) -> Path:
        """
        Retrieves a decrypted file for preview, using a local cache.
        """
        with self.db_session.get_session() as session:
            db = DBManager(session)
            file_record = db.get_file(file_id)
            if not file_record:
                raise ManagerError(f"File {file_id} not found.")
            
            ext = Path(file_record.filename).suffix
            cache_path = cache_dir / f"{file_record.sha256}{ext}"

            if cache_path.exists():
                cache_path.touch()
                return cache_path

            cache_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(cache_path, "wb") as f:
                async for chunk_data in self.download_file_stream(file_id):
                    f.write(chunk_data)
            
            calculated_sha = get_file_sha256(cache_path)
            
            await self.heal_metadata(file_id, cache_path, calculated_sha)

            return cache_path

    async def heal_metadata(self, file_id: str, local_path: Path, actual_sha256: Optional[str] = None) -> bool:
        """
        Recomputes and updates metadata (size, hash, thumbnail) for a file.
        Essential for fully materializing recovered files.
        """
        if not actual_sha256:
            actual_sha256 = get_file_sha256(local_path)
            
        try:
            with self.db_session.get_session() as session:
                db = DBManager(session)
                f_rec = db.get_file(file_id)
                if not f_rec:
                    return False
                
                # 1. Update SHA256 if it was a placeholder
                if f_rec.sha256 in ["pending", "unknown", file_id]:
                    f_rec.sha256 = actual_sha256
                    logger.info(f"Healed SHA256 for {f_rec.filename}")
                
                # 2. Update Size if 0 or mismatch
                actual_size = local_path.stat().st_size
                if f_rec.size != actual_size:
                    f_rec.size = actual_size
                
                # 3. Generate Thumbnail if missing
                if not f_rec.thumbnail:
                    from api.routes.files import generate_thumbnail
                    thumb = generate_thumbnail(local_path)
                    if thumb:
                        f_rec.thumbnail = thumb
                        logger.info(f"Healed Thumbnail for {f_rec.filename}")
                
                f_rec.is_materialized = True
                f_rec.status = "completed"
                return True
        except Exception as e:
            logger.error(f"Metadata healing failed for {file_id}: {e}")
            return False

    async def move_files(self, items: List[Dict[str, str]], destination: str) -> Dict[str, Any]:
        """
        Moves multiple files and folders to a destination directory.
        Uses a transaction to ensure atomicity: if one item fails, the whole operation is rolled back.
        """
        dest_dir = destination if destination.startswith("/") else ("/" + destination)
        dest_dir = dest_dir.rstrip("/") if dest_dir != "/" else "/"
        
        with self.db_session.get_session() as session:
            db = DBManager(session)
            
            db_items = []
            for item in items:
                file_id = item.get("file_id")
                if not file_id:
                    raise ManagerError("Invalid item: missing file_id")
                db_item = db.get_file(file_id)
                if not db_item:
                    raise ManagerError(f"Item not found: {file_id}")
                db_items.append(db_item)
                
            for db_item in db_items:
                curr_vpath = db_item.virtual_path
                curr_name = db_item.filename
                
                if curr_vpath == "/":
                    current_path = "/" + curr_name
                else:
                    current_path = curr_vpath.rstrip("/") + "/" + curr_name
                    
                if dest_dir == "/":
                    new_full_path = "/" + curr_name
                else:
                    new_full_path = dest_dir.rstrip("/") + "/" + curr_name
                
                if current_path == new_full_path:
                    raise ManagerError(f"Cannot move '{curr_name}' to its current location")
                
                if db_item.is_folder:
                    if dest_dir == current_path or dest_dir.startswith(current_path + "/"):
                        raise ManagerError(f"Cannot move folder '{curr_name}' into itself or its subfolders")
                
                if db.item_exists_in_destination(curr_name, dest_dir):
                    raise ManagerError(f"'{curr_name}' already exists in destination")
            
            for db_item in db_items:
                curr_vpath = db_item.virtual_path
                curr_name = db_item.filename
                
                if curr_vpath == "/":
                    current_path = "/" + curr_name
                else:
                    current_path = curr_vpath.rstrip("/") + "/" + curr_name
                    
                if dest_dir == "/":
                    new_full_path = "/" + curr_name
                else:
                    new_full_path = dest_dir.rstrip("/") + "/" + curr_name
                
                if db_item.is_folder:
                    descendants = db.get_all_descendants(current_path)
                    for desc in descendants:
                        relative = desc.virtual_path[len(current_path):]
                        desc.virtual_path = new_full_path + relative
                
                db_item.virtual_path = dest_dir
                
        return {
            "success": True,
            "moved_count": len(items),
            "failed_count": 0,
            "errors": None
        }
