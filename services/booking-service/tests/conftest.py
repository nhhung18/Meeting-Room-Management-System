import os
from unittest.mock import MagicMock

import pytest

# Unit tests không cần DB thật: đặt URL giả trước khi import app.
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.security import TokenPayload, current_user  # noqa: E402
from app.db.session import database_is_healthy, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.services.booking_service import BookingService  # noqa: E402


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


# --- Auth override fixtures ---


@pytest.fixture
def employee_user():
    app.dependency_overrides[current_user] = lambda: TokenPayload(
        sub="emp1", roles=["Employee"]
    )
    yield
    app.dependency_overrides.pop(current_user, None)


@pytest.fixture
def admin_user():
    app.dependency_overrides[current_user] = lambda: TokenPayload(
        sub="admin1", roles=["Administrator"]
    )
    yield
    app.dependency_overrides.pop(current_user, None)


@pytest.fixture
def manager_user():
    app.dependency_overrides[current_user] = lambda: TokenPayload(
        sub="mgr1", roles=["Room Manager"]
    )
    yield
    app.dependency_overrides.pop(current_user, None)


# --- DB mock fixture ---


@pytest.fixture
def mock_db():
    db = MagicMock(spec=Session)
    app.dependency_overrides[get_db] = lambda: db
    yield db
    app.dependency_overrides.pop(get_db, None)


# --- BookingService mock fixture ---


@pytest.fixture
def mock_booking_service():
    svc = MagicMock(spec=BookingService)
    yield svc


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
