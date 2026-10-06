import os

import pytest

# Test không cần DB thật: đặt URL giả trước khi import app.
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
