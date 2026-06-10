"""Database layer for Midwife.

Each Canvas (what the code calls a Session) is one row in the `canvases` table.
The whole discourse tree is stored as JSON in the `data` column; the columns
alongside it (owner, objective, ...) exist so we can look canvases up quickly —
especially "all canvases owned by this person".

Where the database lives is decided by the DATABASE_URL environment variable:
  - If it is not set, we use a local SQLite file (`backend/midwife.db`) that lives
    on this machine only and needs no setup. Great for development.
  - In production we set DATABASE_URL to point at Cloud SQL (Google-managed
    PostgreSQL). The code below does not change — only that one setting does.
"""

import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import (
    Column,
    DateTime,
    JSON,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
)

_DEFAULT_SQLITE_PATH = Path(__file__).parent / "midwife.db"
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{_DEFAULT_SQLITE_PATH}")

# Managed Postgres providers (Render, Heroku, ...) hand out the legacy "postgres://"
# scheme, but SQLAlchemy needs "postgresql://". Normalize it so the same code works
# locally (SQLite) and in production (Postgres).
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite needs this flag so the connection can be reused across request threads;
# it is harmless and ignored for PostgreSQL.
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args)

metadata = MetaData()

canvases = Table(
    "canvases",
    metadata,
    Column("id", String, primary_key=True),
    Column("owner", String, nullable=False, index=True),  # the owner's email
    Column("objective", Text, nullable=False, default=""),
    Column("discourse_name", Text, nullable=False, default=""),
    Column("data", JSON, nullable=False),  # the full SessionState, serialized
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def init_db() -> None:
    """Create the table if it does not exist yet. Safe to call repeatedly."""
    metadata.create_all(engine)
