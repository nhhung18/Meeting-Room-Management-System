"""Test: JWT hết hạn → 401 Unauthorized cho room-service (mandatory scenario S2).

Room-service uses JWTValidator from libs/common. These tests mock the validator
to simulate expired/missing/malformed tokens at the API level.
"""

from unittest.mock import MagicMock

import pytest
from common.auth import AuthError
from fastapi.testclient import TestClient

from app.core.security import get_jwt_validator
from app.db.session import get_db
from app.main import app


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    with TestClient(app) as c:
        yield c


class TestExpiredJWT:
    def test_expired_token_returns_401(self, client):
        mock_validator = MagicMock()
        mock_validator.decode.side_effect = AuthError(401, "Token has expired")
        app.dependency_overrides[get_jwt_validator] = lambda: mock_validator

        resp = client.get(
            "/api/rooms/",
            headers={"Authorization": "Bearer expired.token.here"},
        )
        assert resp.status_code == 401
        assert "expired" in resp.json()["detail"].lower()

    def test_invalid_token_returns_401(self, client):
        mock_validator = MagicMock()
        mock_validator.decode.side_effect = AuthError(401, "Invalid token: bad signature")
        app.dependency_overrides[get_jwt_validator] = lambda: mock_validator

        resp = client.get(
            "/api/rooms/",
            headers={"Authorization": "Bearer garbage.token.xyz"},
        )
        assert resp.status_code == 401

    def test_no_auth_header_returns_401(self, client):
        mock_validator = MagicMock()
        app.dependency_overrides[get_jwt_validator] = lambda: mock_validator

        resp = client.get("/api/rooms/")
        assert resp.status_code == 401
        assert "missing" in resp.json()["detail"].lower()

    def test_malformed_auth_header_returns_401(self, client):
        mock_validator = MagicMock()
        app.dependency_overrides[get_jwt_validator] = lambda: mock_validator

        resp = client.get(
            "/api/rooms/",
            headers={"Authorization": "NotBearer token"},
        )
        assert resp.status_code == 401
