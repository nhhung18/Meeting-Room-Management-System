"""Unit tests cho BookingRepository — mocked Session, không cần DB thật."""

from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingStatus
from app.repositories.booking_repository import BookingRepository


@pytest.fixture
def mock_db():
    return MagicMock(spec=Session)


@pytest.fixture
def repo(mock_db):
    return BookingRepository(mock_db)


def _make_booking(**overrides):
    defaults = {
        "id": 1,
        "room_id": 1,
        "user_id": "u1",
        "start_at": datetime(2099, 1, 1, 9, 0, tzinfo=UTC),
        "end_at": datetime(2099, 1, 1, 10, 0, tzinfo=UTC),
        "num_attendees": 5,
        "status": BookingStatus.CONFIRMED,
        "deleted_at": None,
        "created_at": datetime(2099, 1, 1, 8, 0, tzinfo=UTC),
        "updated_at": datetime(2099, 1, 1, 8, 0, tzinfo=UTC),
    }
    defaults.update(overrides)
    b = MagicMock(spec=Booking)
    for k, v in defaults.items():
        setattr(b, k, v)
    return b


class TestCreate:
    def test_create_adds_and_flushes(self, repo, mock_db):
        booking = _make_booking()
        result = repo.create(booking)
        mock_db.add.assert_called_once_with(booking)
        mock_db.flush.assert_called_once()
        assert result is booking

    def test_create_does_not_commit(self, repo, mock_db):
        repo.create(_make_booking())
        mock_db.commit.assert_not_called()


class TestGetById:
    def test_returns_booking_when_found(self, repo, mock_db):
        booking = _make_booking()
        mock_db.execute.return_value.scalar_one_or_none.return_value = booking
        result = repo.get_by_id(1)
        assert result is booking

    def test_returns_none_when_not_found(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        result = repo.get_by_id(999)
        assert result is None


class TestListByUser:
    def test_returns_items_and_total(self, repo, mock_db):
        bookings = [_make_booking(id=1), _make_booking(id=2)]
        # first execute → items, second execute → total count
        mock_db.execute.side_effect = [
            MagicMock(**{"scalars.return_value.all.return_value": bookings}),
            MagicMock(**{"scalar_one.return_value": 2}),
        ]
        items, total = repo.list_by_user("u1")
        assert len(items) == 2
        assert total == 2

    def test_returns_correct_total_regardless_of_offset(self, repo, mock_db):
        one_booking = [_make_booking(id=3)]
        mock_db.execute.side_effect = [
            MagicMock(**{"scalars.return_value.all.return_value": one_booking}),
            MagicMock(**{"scalar_one.return_value": 10}),
        ]
        items, total = repo.list_by_user("u1", limit=1, offset=9)
        assert len(items) == 1
        assert total == 10  # total is count of all rows, not just this page


class TestListByRoom:
    def test_returns_items_and_total(self, repo, mock_db):
        bookings = [_make_booking(id=1, room_id=5)]
        mock_db.execute.side_effect = [
            MagicMock(**{"scalars.return_value.all.return_value": bookings}),
            MagicMock(**{"scalar_one.return_value": 1}),
        ]
        items, total = repo.list_by_room(5)
        assert len(items) == 1
        assert total == 1


class TestHasOverlap:
    def test_overlap_detected_returns_true(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one.return_value = 1
        result = repo.has_overlap(
            1,
            datetime(2099, 1, 1, 9, tzinfo=UTC),
            datetime(2099, 1, 1, 10, tzinfo=UTC),
        )
        assert result is True

    def test_no_overlap_returns_false(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one.return_value = 0
        result = repo.has_overlap(
            1,
            datetime(2099, 1, 1, 11, tzinfo=UTC),
            datetime(2099, 1, 1, 12, tzinfo=UTC),
        )
        assert result is False

    def test_has_overlap_with_exclude_id_does_not_crash(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one.return_value = 0
        result = repo.has_overlap(
            1,
            datetime(2099, 1, 1, 9, tzinfo=UTC),
            datetime(2099, 1, 1, 10, tzinfo=UTC),
            exclude_id=42,
        )
        assert result is False


class TestUpdate:
    def test_update_flushes(self, repo, mock_db):
        booking = _make_booking()
        result = repo.update(booking)
        mock_db.flush.assert_called_once()
        assert result is booking

    def test_update_sets_updated_at(self, repo, mock_db):
        booking = _make_booking()
        old_time = booking.updated_at
        repo.update(booking)
        assert booking.updated_at != old_time

    def test_update_does_not_commit(self, repo, mock_db):
        repo.update(_make_booking())
        mock_db.commit.assert_not_called()
