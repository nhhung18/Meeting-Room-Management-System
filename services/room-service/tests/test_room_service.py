"""Unit tests cho RoomService — business logic với mocked repository."""

from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest

from app.models.room import Room
from app.schemas.room import RoomCreate, RoomUpdate
from app.services.room_service import RoomService


def _make_room(**kwargs) -> Room:
    defaults = {
        "id": 1,
        "name": "P101",
        "capacity": 10,
        "status": "AVAILABLE",
        "equipment": [],
        "owner_id": None,
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
        "deleted_at": None,
    }
    defaults.update(kwargs)
    room = Room()
    for k, v in defaults.items():
        setattr(room, k, v)
    return room


@pytest.fixture
def mock_repo():
    return MagicMock()


@pytest.fixture
def service(mock_repo):
    return RoomService(mock_repo)


class TestCreateRoom:
    def test_create_room_success(self, service, mock_repo):
        mock_repo.name_exists.return_value = False
        mock_repo.create.return_value = _make_room()
        dto = RoomCreate(name="P101", capacity=10)

        result = service.create_room(dto)

        mock_repo.name_exists.assert_called_once_with("P101")
        mock_repo.create.assert_called_once()
        assert result.name == "P101"
        assert result.capacity == 10

    def test_create_room_with_equipment(self, service, mock_repo):
        mock_repo.name_exists.return_value = False
        mock_repo.create.return_value = _make_room(equipment=["projector"])
        dto = RoomCreate(name="P101", capacity=10, equipment=["projector"])

        result = service.create_room(dto)

        assert result.equipment == ["projector"]

    def test_create_room_duplicate_name_raises(self, service, mock_repo):
        mock_repo.name_exists.return_value = True
        dto = RoomCreate(name="P101", capacity=10)

        with pytest.raises(RoomService.DuplicateNameError):
            service.create_room(dto)

        mock_repo.create.assert_not_called()


class TestGetRoom:
    def test_get_room_found(self, service, mock_repo):
        mock_repo.get_by_id.return_value = _make_room()

        result = service.get_room(1)

        assert result.id == 1
        assert result.name == "P101"

    def test_get_room_not_found_raises(self, service, mock_repo):
        mock_repo.get_by_id.return_value = None

        with pytest.raises(RoomService.NotFoundError):
            service.get_room(999)


class TestListRooms:
    def test_list_rooms_returns_paginated(self, service, mock_repo):
        mock_repo.list_rooms.return_value = ([_make_room()], 1)

        result = service.list_rooms(limit=20, offset=0)

        assert result.total == 1
        assert len(result.items) == 1
        assert result.limit == 20
        assert result.offset == 0

    def test_list_rooms_empty(self, service, mock_repo):
        mock_repo.list_rooms.return_value = ([], 0)

        result = service.list_rooms()

        assert result.total == 0
        assert result.items == []

    def test_list_rooms_passes_filters(self, service, mock_repo):
        mock_repo.list_rooms.return_value = ([], 0)

        service.list_rooms(status="AVAILABLE", q="P1", limit=10, offset=5)

        mock_repo.list_rooms.assert_called_once_with(status="AVAILABLE", q="P1", limit=10, offset=5)


class TestUpdateRoom:
    def test_update_room_success(self, service, mock_repo):
        room = _make_room()
        mock_repo.get_by_id.return_value = room
        mock_repo.name_exists.return_value = False
        mock_repo.update.return_value = _make_room(capacity=20)
        dto = RoomUpdate(capacity=20)

        result = service.update_room(1, dto)

        mock_repo.update.assert_called_once_with(room)
        assert result.capacity == 20

    def test_update_room_no_fields_is_noop(self, service, mock_repo):
        room = _make_room()
        mock_repo.get_by_id.return_value = room
        mock_repo.update.return_value = room
        dto = RoomUpdate()  # no fields set

        service.update_room(1, dto)

        mock_repo.update.assert_called_once()
        mock_repo.name_exists.assert_not_called()

    def test_update_room_not_found_raises(self, service, mock_repo):
        mock_repo.get_by_id.return_value = None
        dto = RoomUpdate(capacity=20)

        with pytest.raises(RoomService.NotFoundError):
            service.update_room(999, dto)

    def test_update_room_duplicate_name_raises(self, service, mock_repo):
        mock_repo.get_by_id.return_value = _make_room(name="P101")
        mock_repo.name_exists.return_value = True
        dto = RoomUpdate(name="P102")

        with pytest.raises(RoomService.DuplicateNameError):
            service.update_room(1, dto)

    def test_update_room_same_name_no_conflict_check(self, service, mock_repo):
        room = _make_room(name="P101")
        mock_repo.get_by_id.return_value = room
        mock_repo.update.return_value = room
        dto = RoomUpdate(name="P101")  # same name — no duplicate check needed

        service.update_room(1, dto)

        mock_repo.name_exists.assert_not_called()


class TestDeleteRoom:
    def test_soft_delete_success(self, service, mock_repo):
        mock_repo.get_by_id.return_value = _make_room()

        service.delete_room(1)

        mock_repo.soft_delete.assert_called_once()

    def test_delete_not_found_raises(self, service, mock_repo):
        mock_repo.get_by_id.return_value = None

        with pytest.raises(RoomService.NotFoundError):
            service.delete_room(999)
