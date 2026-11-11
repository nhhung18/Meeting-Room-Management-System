import os

import pytest

# Unit tests không cần DB thật: đặt URL giả trước khi import app.
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")

from unittest.mock import MagicMock  # noqa: E402

from common.auth import TokenPayload  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.core.security import TokenPayload, current_user  # noqa: E402
from app.db.session import database_is_healthy, get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def employee_user():
    app.dependency_overrides[current_user] = lambda: TokenPayload(sub="emp1", roles=["Employee"])
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


@pytest.fixture
def client(manager_user):
    # Override get_db để unit tests không cần psycopg cài sẵn.
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


# --- Auth override fixtures (mirror booking-service pattern) ---


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


@pytest.fixture
def db_up():
    app.dependency_overrides[database_is_healthy] = lambda: True


@pytest.fixture
def db_down():
    app.dependency_overrides[database_is_healthy] = lambda: False


# ---------------------------------------------------------------------------
# Integration fixtures — chỉ dùng khi pytest.mark.integration
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def db_engine():
    """Real engine dùng DATABASE_URL từ môi trường (Docker integration tests)."""
    url = os.environ["DATABASE_URL"]
    engine = create_engine(url, echo=False)
    yield engine
    engine.dispose()


@pytest.fixture
def db_conn(db_engine):
    """Transaction-scoped connection: mỗi test rollback sau khi chạy xong, không để lại data."""
    with db_engine.connect() as conn:
        conn.begin()
        yield conn
        conn.rollback()


@pytest.fixture
def db_session(db_conn):
    """SQLAlchemy Session bound to the rollback-able connection."""
    Session = sessionmaker(bind=db_conn)
    session = Session()
    yield session
    session.close()
