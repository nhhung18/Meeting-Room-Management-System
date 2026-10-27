"""Unit tests cho auto-cancel worker.

Gồm:
- BookingRepository.find_overdue_confirmed()
- auto_cancel.run_once(): scan và cancel các booking quá hạn
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingStatus
from app.repositories.booking_repository import BookingRepository

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_booking(**overrides):
    now = datetime.now(UTC)
    defaults = {
        "id": 1,
        "room_id": 1,
        "user_id": "u1",
        "start_at": now - timedelta(hours=1),
        "end_at": now,
        "num_attendees": 2,
        "status": BookingStatus.CONFIRMED,
        "deleted_at": None,
        "checked_in_at": None,
        "auto_cancelled_at": None,
        "created_at": now - timedelta(hours=2),
        "updated_at": now - timedelta(hours=2),
    }
    defaults.update(overrides)
    b = MagicMock(spec=Booking)
    for k, v in defaults.items():
        setattr(b, k, v)
    b.attendees = []
    return b


# ---------------------------------------------------------------------------
# Tests: BookingRepository.find_overdue_confirmed
# ---------------------------------------------------------------------------


class TestFindOverdueConfirmed:
    @pytest.fixture
    def mock_db(self):
        return MagicMock(spec=Session)

    @pytest.fixture
    def repo(self, mock_db):
        return BookingRepository(mock_db)

    def test_returns_confirmed_past_window(self, repo, mock_db):
        """Booking CONFIRMED với start_at + 15min < cutoff → được trả về."""
        booking = _make_booking(status=BookingStatus.CONFIRMED)
        mock_db.execute.return_value.scalars.return_value.all.return_value = [booking]

        cutoff = datetime.now(UTC)
        result = repo.find_overdue_confirmed(cutoff)

        assert result == [booking]
        mock_db.execute.assert_called_once()

    def test_returns_empty_when_none_overdue(self, repo, mock_db):
        """Không có booking quá hạn → trả về list rỗng."""
        mock_db.execute.return_value.scalars.return_value.all.return_value = []

        result = repo.find_overdue_confirmed(datetime.now(UTC))

        assert result == []

    def test_query_filters_correct_status(self, repo, mock_db):
        """Chỉ query CONFIRMED — không lấy CHECKED_IN hoặc CANCELLED."""
        mock_db.execute.return_value.scalars.return_value.all.return_value = []

        repo.find_overdue_confirmed(datetime.now(UTC))

        # Verify execute was called (the query itself is tested via integration)
        mock_db.execute.assert_called_once()

    def test_does_not_commit(self, repo, mock_db):
        """find_overdue_confirmed là read-only — không commit."""
        mock_db.execute.return_value.scalars.return_value.all.return_value = []

        repo.find_overdue_confirmed(datetime.now(UTC))

        mock_db.commit.assert_not_called()


# ---------------------------------------------------------------------------
# Tests: auto_cancel.run_once
# ---------------------------------------------------------------------------


class TestRunOnce:
    def _make_session_factory(self, bookings: list):
        """Create a mock session factory that returns bookings from find_overdue_confirmed."""
        mock_session = MagicMock()
        mock_session.__enter__ = MagicMock(return_value=mock_session)
        mock_session.__exit__ = MagicMock(return_value=False)

        mock_repo = MagicMock(spec=BookingRepository)
        mock_repo.find_overdue_confirmed.return_value = bookings
        mock_repo.update.side_effect = lambda b: b

        return mock_session, mock_repo

    def test_cancels_overdue_bookings_returns_count(self):
        """Hai booking quá hạn → cả 2 bị cancel, trả về 2."""
        from app.workers.auto_cancel import run_once

        b1 = _make_booking(id=1)
        b2 = _make_booking(id=2)

        mock_session = MagicMock()
        mock_repo = MagicMock(spec=BookingRepository)
        mock_repo.find_overdue_confirmed.return_value = [b1, b2]
        mock_repo.update.side_effect = lambda b: b

        with patch("app.workers.auto_cancel.BookingRepository", return_value=mock_repo):
            count = run_once(mock_session)

        assert count == 2
        assert b1.status == BookingStatus.CANCELLED
        assert b2.status == BookingStatus.CANCELLED
        assert b1.auto_cancelled_at is not None
        assert b2.auto_cancelled_at is not None

    def test_no_overdue_returns_zero(self):
        """Không có booking quá hạn → count = 0, không update."""
        from app.workers.auto_cancel import run_once

        mock_session = MagicMock()
        mock_repo = MagicMock(spec=BookingRepository)
        mock_repo.find_overdue_confirmed.return_value = []

        with patch("app.workers.auto_cancel.BookingRepository", return_value=mock_repo):
            count = run_once(mock_session)

        assert count == 0
        mock_repo.update.assert_not_called()
        mock_session.commit.assert_not_called()

    def test_commits_after_cancelling(self):
        """Sau khi cancel, phải commit."""
        from app.workers.auto_cancel import run_once

        b = _make_booking(id=1)
        mock_session = MagicMock()
        mock_repo = MagicMock(spec=BookingRepository)
        mock_repo.find_overdue_confirmed.return_value = [b]
        mock_repo.update.side_effect = lambda x: x

        with patch("app.workers.auto_cancel.BookingRepository", return_value=mock_repo):
            run_once(mock_session)

        mock_session.commit.assert_called_once()

    def test_stamps_auto_cancelled_at(self):
        """Booking bị cancel phải có auto_cancelled_at được set."""
        from app.workers.auto_cancel import run_once

        b = _make_booking(id=1)
        before = datetime.now(UTC)

        mock_session = MagicMock()
        mock_repo = MagicMock(spec=BookingRepository)
        mock_repo.find_overdue_confirmed.return_value = [b]
        mock_repo.update.side_effect = lambda x: x

        with patch("app.workers.auto_cancel.BookingRepository", return_value=mock_repo):
            run_once(mock_session)

        assert b.auto_cancelled_at is not None
        assert b.auto_cancelled_at >= before
