"""Unit tests for room event consumer worker."""

from unittest.mock import MagicMock, patch

import pytest

from app.models.room_snapshot import RoomSnapshot
from app.repositories.room_snapshot_repository import RoomSnapshotRepository
from app.workers.room_event_consumer import handle_room_event


def _make_room_created_payload():
    return {
        "event_type": "room.created",
        "payload": {
            "room_id": 1,
            "name": "P101",
            "capacity": 10,
            "status": "AVAILABLE",
            "floor": "Tầng 1",
            "equipment": ["projector"],
            "owner_id": "owner-1",
            "version": 1,
        },
    }


def _make_room_updated_payload():
    return {
        "event_type": "room.updated",
        "payload": {
            "room_id": 1,
            "name": "P101 Updated",
            "capacity": 20,
            "status": "AVAILABLE",
            "floor": "Tầng 1",
            "equipment": ["projector", "whiteboard"],
            "owner_id": "owner-1",
            "version": 2,
        },
    }


def _make_room_deleted_payload():
    return {
        "event_type": "room.deleted",
        "payload": {
            "room_id": 1,
        },
    }


@pytest.fixture
def mock_repo():
    return MagicMock(spec=RoomSnapshotRepository)


class TestHandleRoomEvent:
    def test_room_created_upserts_snapshot(self, mock_repo):
        mock_repo.upsert.return_value = MagicMock(spec=RoomSnapshot)
        event = _make_room_created_payload()

        handle_room_event(event, mock_repo)

        mock_repo.upsert.assert_called_once_with(
            room_id=1,
            name="P101",
            capacity=10,
            status="AVAILABLE",
            floor="Tầng 1",
            equipment=["projector"],
            owner_id="owner-1",
            version=1,
        )

    def test_room_updated_upserts_snapshot(self, mock_repo):
        mock_repo.upsert.return_value = MagicMock(spec=RoomSnapshot)
        event = _make_room_updated_payload()

        handle_room_event(event, mock_repo)

        mock_repo.upsert.assert_called_once_with(
            room_id=1,
            name="P101 Updated",
            capacity=20,
            status="AVAILABLE",
            floor="Tầng 1",
            equipment=["projector", "whiteboard"],
            owner_id="owner-1",
            version=2,
        )

    def test_room_deleted_removes_snapshot(self, mock_repo):
        event = _make_room_deleted_payload()

        handle_room_event(event, mock_repo)

        mock_repo.delete_by_room_id.assert_called_once_with(1)

    def test_stale_version_ignored(self, mock_repo):
        # upsert returns None → stale, no error raised
        mock_repo.upsert.return_value = None
        event = _make_room_created_payload()

        # Should not raise
        handle_room_event(event, mock_repo)

    def test_unknown_event_type_ignored(self, mock_repo):
        event = {"event_type": "room.some_unknown", "payload": {"room_id": 99}}

        # Should not raise
        handle_room_event(event, mock_repo)

        mock_repo.upsert.assert_not_called()
        mock_repo.delete_by_room_id.assert_not_called()
