"""Test: Employee gọi API quản lý phòng → 403 (mandatory scenario S3).

Room CRUD write endpoints require Room Manager or Administrator.
Employee role must be rejected with 403. Read endpoints (GET) are open to all roles.
"""

from unittest.mock import MagicMock

import pytest
from common.auth import TokenPayload
from fastapi.testclient import TestClient

from app.api.rooms import _get_service
from app.core.security import current_user, require_room_manager
from app.db.session import get_db
from app.main import app
from app.schemas.room import RoomResponse


def _room_response(**overrides) -> RoomResponse:
    defaults = {
        "id": 1,
        "name": "Test Room",
        "capacity": 10,
        "status": "AVAILABLE",
        "equipment": [],
        "owner_id": None,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    defaults.update(overrides)
    return RoomResponse(**defaults)


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


@pytest.fixture
def mock_service():
    svc = MagicMock()
    app.dependency_overrides[_get_service] = lambda: svc
    return svc


def _set_user(sub: str, roles: list[str]):
    app.dependency_overrides[current_user] = lambda: TokenPayload(sub=sub, roles=roles)


def _set_manager(sub: str, roles: list[str]):
    app.dependency_overrides[require_room_manager] = lambda: TokenPayload(
        sub=sub, roles=roles
    )


def _block_manager():
    from fastapi import HTTPException

    def _raise():
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    app.dependency_overrides[require_room_manager] = _raise


class TestEmployeeCannotManageRooms:
    def test_employee_cannot_create_room(self, client, mock_service):
        _block_manager()
        resp = client.post("/api/rooms/", json={"name": "X", "capacity": 5})
        assert resp.status_code == 403

    def test_employee_cannot_update_room(self, client, mock_service):
        _block_manager()
        resp = client.patch("/api/rooms/1", json={"name": "Y"})
        assert resp.status_code == 403

    def test_employee_cannot_delete_room(self, client, mock_service):
        _block_manager()
        resp = client.delete("/api/rooms/1")
        assert resp.status_code == 403

    def test_employee_can_list_rooms(self, client, mock_service):
        _set_user("emp1", ["Employee"])
        mock_service.list_rooms.return_value = MagicMock(
            items=[], total=0, limit=20, offset=0,
            model_dump=lambda **kw: {"items": [], "total": 0, "limit": 20, "offset": 0},
        )
        resp = client.get("/api/rooms/")
        assert resp.status_code == 200

    def test_employee_can_get_room(self, client, mock_service):
        _set_user("emp1", ["Employee"])
        mock_service.get_room.return_value = _room_response()
        resp = client.get("/api/rooms/1")
        assert resp.status_code == 200


class TestManagerCanManageRooms:
    def test_manager_can_create_room(self, client, mock_service):
        _set_manager("mgr1", ["Room Manager"])
        mock_service.create_room.return_value = _room_response()
        resp = client.post("/api/rooms/", json={"name": "X", "capacity": 5})
        assert resp.status_code == 201

    def test_manager_can_update_room(self, client, mock_service):
        _set_manager("mgr1", ["Room Manager"])
        mock_service.update_room.return_value = _room_response(name="Y")
        resp = client.patch("/api/rooms/1", json={"name": "Y"})
        assert resp.status_code == 200

    def test_manager_can_delete_room(self, client, mock_service):
        _set_manager("mgr1", ["Room Manager"])
        mock_service.delete_room.return_value = None
        resp = client.delete("/api/rooms/1")
        assert resp.status_code == 204
