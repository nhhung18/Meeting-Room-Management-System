"""Unit tests cho room CRUD endpoints — override _get_service dependency.

conftest.py override get_db → không cần psycopg.
mock_service fixture override _get_service → inject mock service vào router.
Exception classes (NotFoundError, DuplicateNameError) vẫn là class thật
vì _get_service được replace chứ không patch RoomService class.
"""

from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest

from app.api.rooms import _get_service
from app.main import app
from app.schemas.room import RoomListResponse, RoomResponse
from app.services.room_service import RoomService


def _room_response(**overrides) -> RoomResponse:
    defaults = {
        "id": 1,
        "name": "P101",
        "capacity": 10,
        "status": "AVAILABLE",
        "equipment": [],
        "owner_id": None,
        "created_at": datetime(2026, 1, 1, tzinfo=UTC),
        "updated_at": datetime(2026, 1, 1, tzinfo=UTC),
    }
    defaults.update(overrides)
    return RoomResponse(**defaults)


@pytest.fixture
def mock_service():
    svc = MagicMock(spec=RoomService)
    app.dependency_overrides[_get_service] = lambda: svc
    yield svc
    app.dependency_overrides.pop(_get_service, None)


class TestPostRoom:
    def test_create_room_201(self, client, mock_service):
        mock_service.create_room.return_value = _room_response()
        resp = client.post("/api/rooms/", json={"name": "P101", "capacity": 10})
        assert resp.status_code == 201
        assert resp.json()["name"] == "P101"

    def test_create_room_invalid_capacity_422(self, client):
        resp = client.post("/api/rooms/", json={"name": "P101", "capacity": 0})
        assert resp.status_code == 422

    def test_create_room_missing_name_422(self, client):
        resp = client.post("/api/rooms/", json={"capacity": 10})
        assert resp.status_code == 422

    def test_create_room_duplicate_409(self, client, mock_service):
        mock_service.create_room.side_effect = RoomService.DuplicateNameError("already exists")
        resp = client.post("/api/rooms/", json={"name": "P101", "capacity": 10})
        assert resp.status_code == 409
        assert "already exists" in resp.json()["detail"]


class TestGetRoom:
    def test_get_room_200(self, client, mock_service):
        mock_service.get_room.return_value = _room_response()
        resp = client.get("/api/rooms/1")
        assert resp.status_code == 200
        assert resp.json()["id"] == 1
        assert resp.json()["name"] == "P101"

    def test_get_room_not_found_404(self, client, mock_service):
        mock_service.get_room.side_effect = RoomService.NotFoundError("not found")
        resp = client.get("/api/rooms/999")
        assert resp.status_code == 404


class TestListRooms:
    def test_list_rooms_200(self, client, mock_service):
        mock_service.list_rooms.return_value = RoomListResponse(
            items=[], total=0, limit=20, offset=0
        )
        resp = client.get("/api/rooms/")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert data["total"] == 0

    def test_list_rooms_with_status_filter(self, client, mock_service):
        mock_service.list_rooms.return_value = RoomListResponse(
            items=[], total=0, limit=20, offset=0
        )
        resp = client.get("/api/rooms/?status=AVAILABLE")
        assert resp.status_code == 200
        mock_service.list_rooms.assert_called_once_with(
            status="AVAILABLE", q=None, limit=20, offset=0
        )

    def test_list_rooms_invalid_limit_422(self, client):
        resp = client.get("/api/rooms/?limit=0")
        assert resp.status_code == 422

    def test_list_rooms_with_search(self, client, mock_service):
        mock_service.list_rooms.return_value = RoomListResponse(
            items=[_room_response()], total=1, limit=20, offset=0
        )
        resp = client.get("/api/rooms/?q=P1")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1


class TestPatchRoom:
    def test_update_room_200(self, client, mock_service):
        mock_service.update_room.return_value = _room_response(capacity=20)
        resp = client.patch("/api/rooms/1", json={"capacity": 20})
        assert resp.status_code == 200
        assert resp.json()["capacity"] == 20

    def test_update_room_not_found_404(self, client, mock_service):
        mock_service.update_room.side_effect = RoomService.NotFoundError("not found")
        resp = client.patch("/api/rooms/999", json={"capacity": 20})
        assert resp.status_code == 404

    def test_update_room_duplicate_name_409(self, client, mock_service):
        mock_service.update_room.side_effect = RoomService.DuplicateNameError("already exists")
        resp = client.patch("/api/rooms/1", json={"name": "P102"})
        assert resp.status_code == 409

    def test_update_room_invalid_capacity_422(self, client):
        resp = client.patch("/api/rooms/1", json={"capacity": -1})
        assert resp.status_code == 422


class TestDeleteRoom:
    def test_delete_room_204(self, client, mock_service):
        mock_service.delete_room.return_value = None
        resp = client.delete("/api/rooms/1")
        assert resp.status_code == 204

    def test_delete_room_not_found_404(self, client, mock_service):
        mock_service.delete_room.side_effect = RoomService.NotFoundError("not found")
        resp = client.delete("/api/rooms/999")
        assert resp.status_code == 404
