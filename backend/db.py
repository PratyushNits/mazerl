"""
db.py — Async SQLAlchemy setup for MAZE·RL
"""

import os
import uuid
from datetime import datetime

# Load .env FIRST before reading any env vars
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from sqlalchemy import (
    Column, String, Boolean, Float, Integer,
    DateTime, ForeignKey, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import (
    create_async_engine, AsyncSession, async_sessionmaker,
)
from sqlalchemy.orm import DeclarativeBase

# ── Engine ────────────────────────────────────────────────────────────────────
# DATABASE_URL is always injected by docker-compose as an environment variable.
# The fallback uses 'db' (the Docker service name) not 'localhost'.

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://mazerl_user:password@db:5432/mazerl",
)

engine = create_async_engine(DATABASE_URL, echo=False, future=True)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Base ──────────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


# ── Models ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username        = Column(String, unique=True, nullable=False)
    email           = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)


class Score(Base):
    __tablename__ = "scores"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tier         = Column(String(10), nullable=False)
    solved       = Column(Boolean, nullable=False)
    step_count   = Column(Integer, nullable=False)
    time_seconds = Column(Float, nullable=False)
    achieved_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_scores_tier_time", "tier", "time_seconds"),
        Index("ix_scores_user_tier", "user_id", "tier"),
    )


# ── Session dependency ────────────────────────────────────────────────────────

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


# ── Table creation ────────────────────────────────────────────────────────────

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
