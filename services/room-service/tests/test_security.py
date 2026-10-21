"""Tests cho auth/RBAC trên room endpoints."""

from unittest.mock import MagicMock

import pytest
from common.auth import TokenPayload
from fastapi.testclient import TestClient

from app.api.rooms import _get_service
from app.core.security import current_user, require_room_manager
from app.main import app


@pytest.fixture
def mock_service():
    svc = MagicMock()
    app.dependency_overrides[_get_service] = lambda: svc
    yield svc
    app.dependency_overrides.pop(_get_service, None)


def _override_user(payload: TokenPayload):
    """Override current_user dependency để trả về TokenPayload cố định."""
    app.dependency_overrides[current_user] = lambda: payload


def _override_require_room_manager(payload: TokenPayload):
    """Override require_room_manager dependency."""
    app.dependency_overrides[require_room_manager] = lambda: payload


def _override_user_error(status_code: int, detail: str):
    """Override current_user để raise HTTPException."""
    from fastapi import HTTPException

    def _raise():
        raise HTTPException(status_code=status_code, detail=detail)

    app.dependency_overrides[current_user] = _raise


def _override_manager_error(status_code: int, detail: str):
    from fastapi import HTTPException

    def _raise():
        raise HTTPException(status_code=status_code, detail=detail)

    app.dependency_overrides[require_room_manager] = _raise


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    from app.db.session import get_db

    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    with TestClient(app) as c:
        yield c


class TestHealthPublic:
    def test_health_no_auth_required(self, client):
        from app.db.session import database_is_healthy

        app.dependency_overrides[database_is_healthy] = lambda: True
        resp = client.get("/api/rooms/health")
        assert resp.status_code == 200


class TestGetRoomsAuth:
    def test_no_token_returns_401(self, client, mock_service):
        _override_user_error(401, "Missing Authorization header")
        resp = client.get("/api/rooms/")
        assert resp.status_code == 401

    def test_employee_can_list_rooms(self, client, mock_service):
        mock_service.list_rooms.return_value = MagicMock(
            items=[],
            total=0,
            limit=20,
            offset=0,
            model_dump=lambda **kw: {"items": [], "total": 0, "limit": 20, "offset": 0},
        )
        _override_user(TokenPayload(sub="u1", roles=["Employee"]))
        resp = client.get("/api/rooms/")
        assert resp.status_code == 200


class TestPostRoomAuth:
    def test_employee_cannot_create_room(self, client, mock_service):
        _override_manager_error(403, "Insufficient permissions")
        resp = client.post("/api/rooms/", json={"name": "P1", "capacity": 10})
        assert resp.status_code == 403

    def test_manager_can_create_room(self, client, mock_service):
        from app.schemas.room import RoomResponse

        mock_service.create_room.return_value = RoomResponse(
            id=1,
            name="P1",
            capacity=10,
            status="AVAILABLE",
            equipment=[],
            owner_id=None,
            created_at="2026-01-01T00:00:00Z",
            updated_at="2026-01-01T00:00:00Z",
        )
        _override_require_room_manager(TokenPayload(sub="u1", roles=["Room Manager"]))
        resp = client.post("/api/rooms/", json={"name": "P1", "capacity": 10})
        assert resp.status_code == 201


class TestDeleteRoomAuth:
    def test_employee_cannot_delete(self, client, mock_service):
        _override_manager_error(403, "Insufficient permissions")
        resp = client.delete("/api/rooms/1")
        assert resp.status_code == 403

    def test_admin_can_delete(self, client, mock_service):
        _override_require_room_manager(TokenPayload(sub="u1", roles=["Administrator"]))
        mock_service.delete_room.return_value = None
        resp = client.delete("/api/rooms/1")
        assert resp.status_code == 204
