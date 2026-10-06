"""Kết nối PostgreSQL qua SQLAlchemy (tương đương DataSource + EntityManager của Spring).

Engine được tạo lười (lần đầu dùng mới tạo), để test có thể chạy mà không cần DB thật.
"""

import logging
from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache
def get_engine() -> Engine:
    return create_engine(
        get_settings().database_url,
        pool_pre_ping=True,  # kiểm tra kết nối trước khi dùng, tránh lỗi khi DB vừa khởi động lại
        pool_size=5,
        max_overflow=10,
    )


@lru_cache
def _session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Dependency cấp một Session cho mỗi request và luôn đóng nó khi xong."""
    session = _session_factory()()
    try:
        yield session
    finally:
        session.close()


def database_is_healthy() -> bool:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        # Ghi lại lý do để debug, nhưng không trả chi tiết lỗi DB ra ngoài cho client.
        logger.warning("database health check failed", extra={"fields": {"error": str(exc)}})
        return False
