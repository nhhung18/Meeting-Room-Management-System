import os

import pytest

# Unit tests không cần DB thật: đặt URL giả trước khi import app.
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")

from fastapi.testclient import TestClient  # noqa: E402

from app.db.session import database_is_healthy  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def db_up():
    app.dependency_overrides[database_is_healthy] = lambda: True


@pytest.fixture
def db_down():
    app.dependency_overrides[database_is_healthy] = lambda: False


# --- Integration test fixtures (require real Postgres) ---


@pytest.fixture(scope="session")
def db_engine():
    """Engine thật cho integration tests — yêu cầu booking_db đang chạy và đã migrate."""
    from sqlalchemy import create_engine

    from app.core.config import get_settings

    engine = create_engine(get_settings().database_url)
    yield engine
    engine.dispose()


@pytest.fixture
def db_conn(db_engine):
    """Connection chạy trong transaction, rollback sau mỗi test — không để lại rác."""
    with db_engine.connect() as conn, conn.begin():
        yield conn
        conn.rollback()
