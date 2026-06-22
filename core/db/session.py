"""
TDrive Database Session Management.

Handles SQLite engine creation, WAL mode enablement,
and session factory configuration.
"""

import os
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from core.db.models import Base


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """
    Enables WAL mode and Foreign Key constraints for SQLite.
    """
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


class DatabaseSession:
    """
    Manages database lifecycle and session creation.
    """

    def __init__(self, db_path: str):
        """
        Initializes the database engine.

        Args:
            db_path: Path to the SQLite database file.
        """
        self.db_url = f"sqlite:///{db_path}"
        self.engine = create_engine(
            self.db_url,
            connect_args={"check_same_thread": False, "timeout": 30},  
        )
        self.SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=self.engine
        )

    def create_tables(self) -> None:
        """Creates all tables defined in the models."""
        Base.metadata.create_all(bind=self.engine)
        from sqlalchemy import text
        with self.engine.connect() as conn:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_files_sha256 ON files (sha256)"))
            
            # Check and migrate columns
            res = conn.execute(text("PRAGMA table_info(files)")).fetchall()
            columns = [r[1] for r in res]
            if "storage_provider" not in columns:
                conn.execute(text("ALTER TABLE files ADD COLUMN storage_provider VARCHAR(50) DEFAULT 'telegram'"))
                
            conn.commit()

    def drop_tables(self) -> None:
        """Drops all tables (mainly for testing)."""
        Base.metadata.drop_all(bind=self.engine)

    @contextmanager
    def get_session(self) -> Generator[Session, None, None]:
        """
        Context manager for database sessions.
        Ensures proper closing and rollback on failure.
        """
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
