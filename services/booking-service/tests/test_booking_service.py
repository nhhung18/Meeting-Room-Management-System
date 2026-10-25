"""Unit tests for BookingService — all repos mocked, no DB needed."""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest

from app.models.booking import Booking, BookingAttendee, BookingStatus
from app.models.room_snapshot import RoomSnapshot
from app.repositories.booking_repository import BookingRepository
from app.repositories.room_snapshot_repository import RoomSnapshotRepository
from app.schemas.booking import AttendeeInput, BookingCreate, BookingUpdate
from app.services.booking_service import BookingService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_snapshot(
    room_id: int = 1,
    capacity: int = 10,
    status: str = "AVAILABLE",
    owner_id: str | None = "owner-1",
    name: str = "Room A",
) -> MagicMock:
    snap = MagicMock(spec=RoomSnapshot)
    snap.room_id = room_id
    snap.name = name
    snap.capacity = capacity
    snap.status = status
    snap.owner_id = owner_id
    snap.version = 1
    return snap


def _make_booking(
    id: int = 1,
    room_id: int = 1,
    user_id: str = "user-1",
    status: str = BookingStatus.CONFIRMED,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    num_attendees: int = 5,
    attendees: list | None = None,
) -> MagicMock:
    now = datetime.now(UTC)
    booking = MagicMock(spec=Booking)
    booking.id = id
    booking.room_id = room_id
    booking.user_id = user_id
    booking.status = status
    booking.start_at = start_at or (now + timedelta(hours=1))
    booking.end_at = end_at or (now + timedelta(hours=2))
    booking.num_attendees = num_attendees
    booking.attendees = attendees if attendees is not None else []
    booking.checked_in_at = None
    booking.auto_cancelled_at = None
    booking.created_at = now
    booking.updated_at = now
    return booking


def _future_dto(**kwargs) -> BookingCreate:
    now = datetime.now(UTC)
    defaults = dict(
        room_id=1,
        start_at=now + timedelta(hours=1),
        end_at=now + timedelta(hours=2),
        num_attendees=5,
    )
    defaults.update(kwargs)
    return BookingCreate(**defaults)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_booking_repo() -> MagicMock:
    return MagicMock(spec=BookingRepository)


@pytest.fixture
def mock_snapshot_repo() -> MagicMock:
    return MagicMock(spec=RoomSnapshotRepository)


@pytest.fixture
def service(mock_booking_repo, mock_snapshot_repo) -> BookingService:
    return BookingService(mock_booking_repo, mock_snapshot_repo)


# ---------------------------------------------------------------------------
# TestCreateBooking
# ---------------------------------------------------------------------------


class TestCreateBooking:
    def test_create_success(self, service, mock_snapshot_repo, mock_booking_repo):
        snap = _make_snapshot(capacity=10, status="AVAILABLE")
        mock_snapshot_repo.get_by_room_id.return_value = snap
        mock_booking_repo.has_overlap.return_value = False

        created_booking = _make_booking()
        mock_booking_repo.create.return_value = created_booking

        dto = _future_dto(num_attendees=5)
        result = service.create_booking(dto, user_id="user-1")

        mock_booking_repo.create.assert_called_once()
        assert result.status == BookingStatus.CONFIRMED
        assert result.room_name == "Room A"

    def test_create_room_not_found_raises(self, service, mock_snapshot_repo):
        mock_snapshot_repo.get_by_room_id.return_value = None

        with pytest.raises(BookingService.NotFoundError):
            service.create_booking(_future_dto(), user_id="user-1")

    def test_create_room_maintenance_raises(self, service, mock_snapshot_repo):
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot(status="MAINTENANCE")

        with pytest.raises(BookingService.RoomNotAvailableError):
            service.create_booking(_future_dto(), user_id="user-1")

    def test_create_past_start_raises(self, service, mock_snapshot_repo):
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot()
        now = datetime.now(UTC)
        dto = BookingCreate(
            room_id=1,
            start_at=now - timedelta(hours=1),
            end_at=now + timedelta(hours=1),
            num_attendees=5,
        )

        with pytest.raises(BookingService.PastBookingError):
            service.create_booking(dto, user_id="user-1")

    def test_create_start_at_exactly_now_rejected(self, service, mock_snapshot_repo):
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot()
        # Capture now before the service call so start_at <= service's datetime.now(UTC)
        now = datetime.now(UTC)
        dto = BookingCreate(
            room_id=1,
            start_at=now,
            end_at=now + timedelta(hours=1),
            num_attendees=5,
        )

        with pytest.raises(BookingService.PastBookingError):
            service.create_booking(dto, user_id="user-1")

    def test_create_capacity_exceeded_raises(self, service, mock_snapshot_repo):
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot(capacity=5)

        with pytest.raises(BookingService.CapacityExceededError):
            service.create_booking(_future_dto(num_attendees=15), user_id="user-1")

    def test_create_capacity_exceeded_by_one(self, service, mock_snapshot_repo):
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot(capacity=10)

        with pytest.raises(BookingService.CapacityExceededError):
            service.create_booking(_future_dto(num_attendees=11), user_id="user-1")

    def test_create_capacity_at_exact_limit_allowed(
        self, service, mock_snapshot_repo, mock_booking_repo
    ):
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot(capacity=10)
        mock_booking_repo.has_overlap.return_value = False
        mock_booking_repo.create.return_value = _make_booking(num_attendees=10)

        result = service.create_booking(_future_dto(num_attendees=10), user_id="user-1")
        assert result is not None

    def test_create_overlap_raises(self, service, mock_snapshot_repo, mock_booking_repo):
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot()
        mock_booking_repo.has_overlap.return_value = True

        with pytest.raises(BookingService.OverlapError):
            service.create_booking(_future_dto(), user_id="user-1")

    def test_create_builds_attendees(self, service, mock_snapshot_repo, mock_booking_repo):
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot()
        mock_booking_repo.has_overlap.return_value = False

        attendee_mock = MagicMock(spec=BookingAttendee)
        attendee_mock.id = 1
        attendee_mock.attendee_email = "a@example.com"
        attendee_mock.name = "Alice"
        mock_booking_repo.create.return_value = _make_booking(attendees=[attendee_mock])

        dto = _future_dto(
            attendees=[AttendeeInput(email="a@example.com", name="Alice")]
        )
        service.create_booking(dto, user_id="user-1")

        call_args = mock_booking_repo.create.call_args[0][0]
        assert len(call_args.attendees) == 1
        assert call_args.attendees[0].attendee_email == "a@example.com"


# ---------------------------------------------------------------------------
# TestGetBooking
# ---------------------------------------------------------------------------


class TestGetBooking:
    def test_get_existing(self, service, mock_booking_repo, mock_snapshot_repo):
        booking = _make_booking(room_id=1)
        mock_booking_repo.get_by_id.return_value = booking
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot(name="Room A")

        result = service.get_booking(1)
        assert result.room_name == "Room A"

    def test_get_not_found_raises(self, service, mock_booking_repo):
        mock_booking_repo.get_by_id.return_value = None

        with pytest.raises(BookingService.NotFoundError):
            service.get_booking(999)


# ---------------------------------------------------------------------------
# TestListBookings
# ---------------------------------------------------------------------------


class TestListBookings:
    def test_list_by_user(self, service, mock_booking_repo, mock_snapshot_repo):
        booking = _make_booking()
        mock_booking_repo.list_by_user.return_value = ([booking], 1)
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot()

        result = service.list_bookings(user_id="user-1")
        assert len(result.items) == 1
        assert result.total == 1

    def test_list_by_room(self, service, mock_booking_repo, mock_snapshot_repo):
        booking = _make_booking()
        mock_booking_repo.list_by_room.return_value = ([booking], 1)
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot()

        result = service.list_bookings(room_id=1)
        assert len(result.items) == 1


# ---------------------------------------------------------------------------
# TestCancelBooking
# ---------------------------------------------------------------------------


class TestCancelBooking:
    def test_cancel_confirmed_success(self, service, mock_booking_repo, mock_snapshot_repo):
        booking = _make_booking(status=BookingStatus.CONFIRMED)
        mock_booking_repo.get_by_id.return_value = booking
        mock_booking_repo.update.return_value = booking
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot()

        service.cancel_booking(1)
        assert booking.status == BookingStatus.CANCELLED
        mock_booking_repo.update.assert_called_once_with(booking)

    def test_cancel_checked_in_success(self, service, mock_booking_repo, mock_snapshot_repo):
        booking = _make_booking(status=BookingStatus.CHECKED_IN)
        mock_booking_repo.get_by_id.return_value = booking
        mock_booking_repo.update.return_value = booking
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot()

        service.cancel_booking(1)
        assert booking.status == BookingStatus.CANCELLED

    def test_cancel_already_cancelled_raises(self, service, mock_booking_repo):
        booking = _make_booking(status=BookingStatus.CANCELLED)
        mock_booking_repo.get_by_id.return_value = booking

        with pytest.raises(BookingService.InvalidStateError):
            service.cancel_booking(1)

    def test_cancel_not_found_raises(self, service, mock_booking_repo):
        mock_booking_repo.get_by_id.return_value = None

        with pytest.raises(BookingService.NotFoundError):
            service.cancel_booking(999)


# ---------------------------------------------------------------------------
# TestUpdateBooking
# ---------------------------------------------------------------------------


class TestUpdateBooking:
    def test_update_num_attendees_only(
        self, service, mock_booking_repo, mock_snapshot_repo
    ):
        booking = _make_booking(status=BookingStatus.CONFIRMED, num_attendees=5)
        mock_booking_repo.get_by_id.return_value = booking
        mock_booking_repo.update.return_value = booking
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot()

        dto = BookingUpdate(num_attendees=8)
        service.update_booking(1, dto, user_id="user-1")

        assert booking.num_attendees == 8
        mock_booking_repo.has_overlap.assert_not_called()

    def test_update_checked_in_booking_raises(self, service, mock_booking_repo):
        booking = _make_booking(status=BookingStatus.CHECKED_IN)
        mock_booking_repo.get_by_id.return_value = booking

        with pytest.raises(BookingService.InvalidStateError):
            service.update_booking(1, BookingUpdate(num_attendees=3), user_id="user-1")

    def test_update_cancelled_booking_raises(self, service, mock_booking_repo):
        booking = _make_booking(status=BookingStatus.CANCELLED)
        mock_booking_repo.get_by_id.return_value = booking

        with pytest.raises(BookingService.InvalidStateError):
            service.update_booking(1, BookingUpdate(num_attendees=3), user_id="user-1")

    def test_update_not_found_raises(self, service, mock_booking_repo):
        mock_booking_repo.get_by_id.return_value = None

        with pytest.raises(BookingService.NotFoundError):
            service.update_booking(999, BookingUpdate(num_attendees=3), user_id="user-1")

    def test_update_time_change_triggers_overlap_recheck(
        self, service, mock_booking_repo, mock_snapshot_repo
    ):
        now = datetime.now(UTC)
        booking = _make_booking(
            id=1,
            status=BookingStatus.CONFIRMED,
            start_at=now + timedelta(hours=2),
            end_at=now + timedelta(hours=3),
        )
        mock_booking_repo.get_by_id.return_value = booking
        mock_booking_repo.has_overlap.return_value = True
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot()

        new_start = now + timedelta(hours=4)
        dto = BookingUpdate(start_at=new_start)

        with pytest.raises(BookingService.OverlapError):
            service.update_booking(1, dto, user_id="user-1")

        mock_booking_repo.has_overlap.assert_called_once()
        call_kwargs = mock_booking_repo.has_overlap.call_args.kwargs
        assert call_kwargs.get("exclude_id") == 1

    def test_update_time_change_past_rejected(
        self, service, mock_booking_repo, mock_snapshot_repo
    ):
        now = datetime.now(UTC)
        booking = _make_booking(status=BookingStatus.CONFIRMED)
        mock_booking_repo.get_by_id.return_value = booking
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot()

        dto = BookingUpdate(start_at=now - timedelta(hours=1))

        with pytest.raises(BookingService.PastBookingError):
            service.update_booking(1, dto, user_id="user-1")
