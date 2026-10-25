"""Unit tests for bookings API — BookingService is mocked, no real DB."""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest
from sqlalchemy.exc import IntegrityError

from app.main import app
from app.schemas.booking import BookingListResponse, BookingResponse
from app.services.booking_service import BookingService

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_NOW = datetime.now(UTC)


def _booking_response(**kwargs) -> BookingResponse:
    defaults = dict(
        id=1,
        room_id=1,
        user_id="emp1",
        start_at=_NOW + timedelta(hours=1),
        end_at=_NOW + timedelta(hours=2),
        num_attendees=5,
        status="CONFIRMED",
        checked_in_at=None,
        auto_cancelled_at=None,
        created_at=_NOW,
        updated_at=_NOW,
        room_name="Room A",
        attendees=[],
    )
    defaults.update(kwargs)
    return BookingResponse(**defaults)


def _valid_body(**kwargs):
    body = dict(
        room_id=1,
        start_at=(_NOW + timedelta(hours=1)).isoformat(),
        end_at=(_NOW + timedelta(hours=2)).isoformat(),
        num_attendees=5,
    )
    body.update(kwargs)
    return body


# ---------------------------------------------------------------------------
# Fixtures — inject mock service into router via dependency override
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _mock_db(mock_db):
    """Auto-use mock_db for all tests in this module."""
    pass


@pytest.fixture
def mock_service(mock_booking_service):
    """Wire mock BookingService into the router via dependency_overrides."""
    from app.api import bookings as bookings_module

    app.dependency_overrides[bookings_module._get_booking_service] = (
        lambda db=None: mock_booking_service
    )
    yield mock_booking_service
    app.dependency_overrides.pop(bookings_module._get_booking_service, None)


@pytest.fixture
def mock_sync(mock_booking_service):
    """Wire mock RoomSnapshotSync into the router."""
    from app.api import bookings as bookings_module
    from app.services.room_snapshot_sync import RoomSnapshotSync

    sync = MagicMock(spec=RoomSnapshotSync)
    app.dependency_overrides[bookings_module._get_sync_service] = lambda db=None: sync
    yield sync
    app.dependency_overrides.pop(bookings_module._get_sync_service, None)


# ---------------------------------------------------------------------------
# TestCreateBooking
# ---------------------------------------------------------------------------


class TestCreateBooking:
    def test_create_201(self, client, admin_user, mock_service):
        mock_service.create_booking.return_value = _booking_response()
        resp = client.post("/api/bookings/", json=_valid_body())
        assert resp.status_code == 201

    def test_create_room_not_found_404(self, client, admin_user, mock_service):
        mock_service.create_booking.side_effect = BookingService.NotFoundError("room not found")
        resp = client.post("/api/bookings/", json=_valid_body())
        assert resp.status_code == 404

    def test_create_overlap_409(self, client, admin_user, mock_service):
        mock_service.create_booking.side_effect = BookingService.OverlapError("overlap")
        resp = client.post("/api/bookings/", json=_valid_body())
        assert resp.status_code == 409

    def test_create_past_422(self, client, admin_user, mock_service):
        mock_service.create_booking.side_effect = BookingService.PastBookingError("past")
        resp = client.post("/api/bookings/", json=_valid_body())
        assert resp.status_code == 422

    def test_create_capacity_exceeded_422(self, client, admin_user, mock_service):
        mock_service.create_booking.side_effect = BookingService.CapacityExceededError("cap")
        resp = client.post("/api/bookings/", json=_valid_body())
        assert resp.status_code == 422

    def test_create_room_not_available_409(self, client, admin_user, mock_service):
        mock_service.create_booking.side_effect = BookingService.RoomNotAvailableError("maint")
        resp = client.post("/api/bookings/", json=_valid_body())
        assert resp.status_code == 409

    def test_integrity_error_becomes_409(self, client, admin_user, mock_service):
        mock_service.create_booking.side_effect = IntegrityError(
            "no_overlapping_bookings", {}, Exception("constraint violation")
        )
        resp = client.post("/api/bookings/", json=_valid_body())
        assert resp.status_code == 409


# ---------------------------------------------------------------------------
# TestGetBooking
# ---------------------------------------------------------------------------


class TestGetBooking:
    def test_get_200(self, client, admin_user, mock_service):
        mock_service.get_booking.return_value = _booking_response()
        resp = client.get("/api/bookings/1")
        assert resp.status_code == 200
        assert resp.json()["id"] == 1

    def test_get_not_found_404(self, client, admin_user, mock_service):
        mock_service.get_booking.side_effect = BookingService.NotFoundError("not found")
        resp = client.get("/api/bookings/999")
        assert resp.status_code == 404

    def test_employee_can_get_own_booking(self, client, employee_user, mock_service):
        mock_service.get_booking.return_value = _booking_response(user_id="emp1")
        resp = client.get("/api/bookings/1")
        assert resp.status_code == 200

    def test_employee_cannot_get_other_booking(self, client, employee_user, mock_service):
        mock_service.get_booking.return_value = _booking_response(user_id="other_user")
        resp = client.get("/api/bookings/1")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# TestListBookings
# ---------------------------------------------------------------------------


class TestListBookings:
    def test_employee_list_uses_own_user_id(self, client, employee_user, mock_service):
        mock_service.list_bookings.return_value = BookingListResponse(
            items=[], total=0, limit=20, offset=0
        )
        resp = client.get("/api/bookings/")
        assert resp.status_code == 200
        mock_service.list_bookings.assert_called_once()
        call_kwargs = mock_service.list_bookings.call_args.kwargs
        assert call_kwargs.get("user_id") == "emp1"

    def test_admin_list_all(self, client, admin_user, mock_service):
        mock_service.list_bookings.return_value = BookingListResponse(
            items=[], total=0, limit=20, offset=0
        )
        resp = client.get("/api/bookings/")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# TestCancelBooking
# ---------------------------------------------------------------------------


class TestCancelBooking:
    def test_owner_can_cancel(self, client, employee_user, mock_service):
        mock_service.get_booking.return_value = _booking_response(user_id="emp1")
        mock_service.cancel_booking.return_value = _booking_response(status="CANCELLED")
        resp = client.post("/api/bookings/1/cancel")
        assert resp.status_code == 200

    def test_cancel_other_employee_forbidden(self, client, employee_user, mock_service):
        mock_service.get_booking.return_value = _booking_response(user_id="other_user")
        resp = client.post("/api/bookings/1/cancel")
        assert resp.status_code == 403

    def test_admin_can_cancel_any(self, client, admin_user, mock_service):
        mock_service.get_booking.return_value = _booking_response(user_id="other_user")
        mock_service.cancel_booking.return_value = _booking_response(status="CANCELLED")
        resp = client.post("/api/bookings/1/cancel")
        assert resp.status_code == 200

    def test_cancel_already_cancelled_409(self, client, admin_user, mock_service):
        mock_service.get_booking.return_value = _booking_response()
        mock_service.cancel_booking.side_effect = BookingService.InvalidStateError("cancelled")
        resp = client.post("/api/bookings/1/cancel")
        assert resp.status_code == 409

    def test_cancel_not_found_404(self, client, admin_user, mock_service):
        mock_service.get_booking.side_effect = BookingService.NotFoundError("not found")
        resp = client.post("/api/bookings/999/cancel")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# TestUpdateBooking
# ---------------------------------------------------------------------------


class TestUpdateBooking:
    def test_owner_can_update(self, client, employee_user, mock_service):
        mock_service.get_booking.return_value = _booking_response(user_id="emp1")
        mock_service.update_booking.return_value = _booking_response(num_attendees=8)
        resp = client.patch("/api/bookings/1", json={"num_attendees": 8})
        assert resp.status_code == 200

    def test_other_employee_cannot_update(self, client, employee_user, mock_service):
        mock_service.get_booking.return_value = _booking_response(user_id="other_user")
        resp = client.patch("/api/bookings/1", json={"num_attendees": 8})
        assert resp.status_code == 403

    def test_admin_can_update_any(self, client, admin_user, mock_service):
        mock_service.get_booking.return_value = _booking_response(user_id="other_user")
        mock_service.update_booking.return_value = _booking_response()
        resp = client.patch("/api/bookings/1", json={"num_attendees": 3})
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# TestSyncRooms
# ---------------------------------------------------------------------------


class TestSyncRooms:
    def test_admin_can_sync(self, client, admin_user, mock_sync):
        mock_sync.sync_from_room_service.return_value = 5
        resp = client.post("/api/bookings/admin/sync-rooms")
        assert resp.status_code == 200
        assert resp.json()["synced"] == 5

    def test_sync_rooms_employee_forbidden(self, client, employee_user):
        resp = client.post("/api/bookings/admin/sync-rooms")
        assert resp.status_code == 403
