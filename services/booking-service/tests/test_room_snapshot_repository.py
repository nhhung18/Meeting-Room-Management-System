"""Unit tests cho RoomSnapshotRepository — mocked Session, không cần DB thật."""

from unittest.mock import MagicMock

import pytest
from sqlalchemy.orm import Session

from app.models.room_snapshot import RoomSnapshot
from app.repositories.room_snapshot_repository import RoomSnapshotRepository


@pytest.fixture
def mock_db():
    return MagicMock(spec=Session)


@pytest.fixture
def repo(mock_db):
    return RoomSnapshotRepository(mock_db)


def _make_snapshot(**overrides):
    defaults = {
        "room_id": 1,
        "name": "Room A",
        "capacity": 10,
        "status": "AVAILABLE",
        "equipment": [],
        "owner_id": None,
        "version": 1,
    }
    defaults.update(overrides)
    snap = MagicMock(spec=RoomSnapshot)
    for k, v in defaults.items():
        setattr(snap, k, v)
    return snap


class TestGetByRoomId:
    def test_returns_snapshot_when_found(self, repo, mock_db):
        snap = _make_snapshot()
        mock_db.execute.return_value.scalar_one_or_none.return_value = snap
        result = repo.get_by_room_id(1)
        assert result is snap

    def test_returns_none_when_not_found(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        result = repo.get_by_room_id(999)
        assert result is None


class TestUpsert:
    def test_insert_new_snapshot_when_not_exists(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        result = repo.upsert(
            room_id=1, name="Room A", capacity=10,
            status="AVAILABLE", equipment=[], owner_id=None, version=1,
        )
        assert result is not None
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()

    def test_upsert_updates_when_incoming_version_is_newer(self, repo, mock_db):
        existing = _make_snapshot(version=3)
        mock_db.execute.return_value.scalar_one_or_none.return_value = existing
        result = repo.upsert(
            room_id=1, name="Room A Updated", capacity=20,
            status="AVAILABLE", equipment=["projector"], owner_id="mgr1", version=5,
        )
        assert result is not None
        assert existing.name == "Room A Updated"
        assert existing.capacity == 20
        assert existing.version == 5
        mock_db.flush.assert_called_once()

    def test_upsert_skips_stale_version(self, repo, mock_db):
        existing = _make_snapshot(version=5, name="Room A")
        mock_db.execute.return_value.scalar_one_or_none.return_value = existing
        result = repo.upsert(
            room_id=1, name="Stale Name", capacity=5,
            status="MAINTENANCE", equipment=[], owner_id=None, version=3,
        )
        assert result is None
        assert existing.name == "Room A"  # không thay đổi
        mock_db.flush.assert_not_called()

    def test_upsert_skips_same_version(self, repo, mock_db):
        existing = _make_snapshot(version=5, name="Room A")
        mock_db.execute.return_value.scalar_one_or_none.return_value = existing
        result = repo.upsert(
            room_id=1, name="Same Version", capacity=5,
            status="MAINTENANCE", equipment=[], owner_id=None, version=5,
        )
        assert result is None
        mock_db.flush.assert_not_called()

    def test_insert_does_not_commit(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        repo.upsert(room_id=2, name="B", capacity=5, status="AVAILABLE", equipment=[], owner_id=None, version=1)
        mock_db.commit.assert_not_called()


class TestListAvailable:
    def test_returns_available_rooms(self, repo, mock_db):
        rooms = [_make_snapshot(room_id=1), _make_snapshot(room_id=2)]
        mock_db.execute.return_value.scalars.return_value.all.return_value = rooms
        result = repo.list_available()
        assert len(result) == 2

    def test_returns_empty_when_none_available(self, repo, mock_db):
        mock_db.execute.return_value.scalars.return_value.all.return_value = []
        result = repo.list_available()
        assert result == []

    def test_filters_by_min_capacity(self, repo, mock_db):
        mock_db.execute.return_value.scalars.return_value.all.return_value = []
        result = repo.list_available(min_capacity=50)
        assert result == []
