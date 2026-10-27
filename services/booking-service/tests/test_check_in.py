"""Unit tests for BookingService.check_in_booking().

Check-in window: [start_at - 15min, start_at + 15min] (inclusive on both ends).
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest

from app.models.booking import Booking, BookingStatus
from app.services.booking_service import BookingService


@pytest.fixture
def service():
    booking_repo = MagicMock()
    snapshot_repo = MagicMock()
    svc = BookingService(booking_repo, snapshot_repo)
    mock_snapshot = MagicMock()
    mock_snapshot.name = "Room A"
    snapshot_repo.get_by_room_id.return_value = mock_snapshot
    return svc


def _make_booking(status=BookingStatus.CONFIRMED, start_offset_minutes=5):
    """Create a Booking ORM stub with start_at offset from now."""
    now = datetime.now(UTC)
    start = now + timedelta(minutes=start_offset_minutes)
    b = Booking(
        id=1,
        room_id=1,
        user_id="user-1",
        start_at=start,
        end_at=start + timedelta(hours=1),
        num_attendees=2,
        status=status,
        created_at=now,
        updated_at=now,
    )
    b.attendees = []
    return b


class TestCheckInBooking:
    def test_check_in_within_window_succeeds(self, service):
        """now is 5min before start_at — inside [-15, +15] window."""
        booking = _make_booking(start_offset_minutes=5)
        service._booking_repo.get_by_id.return_value = booking

        result = service.check_in_booking(1)

        assert result.status == BookingStatus.CHECKED_IN
        assert booking.checked_in_at is not None

    def test_check_in_too_early_raises(self, service):
        """now is 30min before start_at — before window opens."""
        booking = _make_booking(start_offset_minutes=30)
        service._booking_repo.get_by_id.return_value = booking

        with pytest.raises(BookingService.CheckInWindowError):
            service.check_in_booking(1)

    def test_check_in_too_late_raises(self, service):
        """now is 20min after start_at — window closed."""
        booking = _make_booking(start_offset_minutes=-20)
        service._booking_repo.get_by_id.return_value = booking

        with pytest.raises(BookingService.CheckInWindowError):
            service.check_in_booking(1)

    def test_check_in_cancelled_raises_invalid_state(self, service):
        """Already CANCELLED — cannot check in."""
        booking = _make_booking(status=BookingStatus.CANCELLED)
        service._booking_repo.get_by_id.return_value = booking

        with pytest.raises(BookingService.InvalidStateError):
            service.check_in_booking(1)

    def test_check_in_already_checked_in_raises_invalid_state(self, service):
        """Already CHECKED_IN — cannot check in again."""
        booking = _make_booking(status=BookingStatus.CHECKED_IN)
        service._booking_repo.get_by_id.return_value = booking

        with pytest.raises(BookingService.InvalidStateError):
            service.check_in_booking(1)

    def test_check_in_not_found_raises(self, service):
        """Booking not found → NotFoundError."""
        service._booking_repo.get_by_id.return_value = None

        with pytest.raises(BookingService.NotFoundError):
            service.check_in_booking(999)

    def test_check_in_near_open_boundary_succeeds(self, service):
        """14min before start_at — safely inside window open (±15min), should succeed."""
        booking = _make_booking(start_offset_minutes=14)
        service._booking_repo.get_by_id.return_value = booking

        result = service.check_in_booking(1)

        assert result.status == BookingStatus.CHECKED_IN

    def test_check_in_near_close_boundary_succeeds(self, service):
        """14min after start_at — safely inside window close (±15min), should succeed."""
        booking = _make_booking(start_offset_minutes=-14)
        service._booking_repo.get_by_id.return_value = booking

        result = service.check_in_booking(1)

        assert result.status == BookingStatus.CHECKED_IN
