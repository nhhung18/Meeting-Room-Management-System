"""Test: Employee/Manager gọi API dành cho Admin → 403 (mandatory scenario S3).

Covers RBAC enforcement on admin-only endpoints in booking-service:
- POST /admin/sync-rooms requires Administrator
- Employee can only see/cancel own bookings, not others'
"""

from unittest.mock import MagicMock

import pytest

from app.api.bookings import _get_booking_service, _get_sync_service
from app.core.security import TokenPayload, current_user
from app.db.session import get_db
from app.main import app
from app.schemas.booking import BookingResponse


def _booking_response(user_id: str = "other_user") -> BookingResponse:
    return BookingResponse(
        id=1,
        room_id=1,
        user_id=user_id,
        start_at="2099-01-01T09:00:00+00:00",
        end_at="2099-01-01T10:00:00+00:00",
        num_attendees=2,
        status="CONFIRMED",
        checked_in_at=None,
        auto_cancelled_at=None,
        created_at="2026-01-01T00:00:00+00:00",
        updated_at="2026-01-01T00:00:00+00:00",
        room_name="Room A",
        attendees=[],
    )


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def mock_db():
    db = MagicMock()
    app.dependency_overrides[get_db] = lambda: db
    return db


@pytest.fixture
def mock_service():
    svc = MagicMock()
    app.dependency_overrides[_get_booking_service] = lambda: svc
    return svc


@pytest.fixture
def mock_sync():
    svc = MagicMock()
    app.dependency_overrides[_get_sync_service] = lambda: svc
    return svc


def _set_user(sub: str, roles: list[str]):
    app.dependency_overrides[current_user] = lambda: TokenPayload(sub=sub, roles=roles)


class TestEmployeeCannotAccessAdminEndpoints:
    def test_employee_cannot_sync_rooms(self, mock_db):
        _set_user("emp1", ["Employee"])
        from fastapi.testclient import TestClient

        with TestClient(app) as client:
            resp = client.post("/api/bookings/admin/sync-rooms")
        assert resp.status_code == 403

    def test_manager_cannot_sync_rooms(self, mock_db):
        _set_user("mgr1", ["Room Manager"])
        from fastapi.testclient import TestClient

        with TestClient(app) as client:
            resp = client.post("/api/bookings/admin/sync-rooms")
        assert resp.status_code == 403

    def test_admin_can_sync_rooms(self, mock_db, mock_sync):
        _set_user("admin1", ["Administrator"])
        mock_sync.sync_from_room_service.return_value = 3
        from fastapi.testclient import TestClient

        with TestClient(app) as client:
            resp = client.post("/api/bookings/admin/sync-rooms")
        assert resp.status_code == 200


class TestEmployeeCannotAccessOtherBookings:
    def test_employee_cannot_get_other_booking(self, mock_db, mock_service):
        _set_user("emp1", ["Employee"])
        mock_service.get_booking.return_value = _booking_response(user_id="other_user")
        from fastapi.testclient import TestClient

        with TestClient(app) as client:
            resp = client.get("/api/bookings/1")
        assert resp.status_code == 403

    def test_employee_can_get_own_booking(self, mock_db, mock_service):
        _set_user("emp1", ["Employee"])
        mock_service.get_booking.return_value = _booking_response(user_id="emp1")
        from fastapi.testclient import TestClient

        with TestClient(app) as client:
            resp = client.get("/api/bookings/1")
        assert resp.status_code == 200

    def test_employee_cannot_cancel_other_booking(self, mock_db, mock_service):
        _set_user("emp1", ["Employee"])
        mock_service.cancel_booking.return_value = _booking_response(user_id="other_user")
        from fastapi.testclient import TestClient

        with TestClient(app) as client:
            resp = client.post("/api/bookings/1/cancel")
        assert resp.status_code == 403

    def test_admin_can_get_any_booking(self, mock_db, mock_service):
        _set_user("admin1", ["Administrator"])
        mock_service.get_booking.return_value = _booking_response(user_id="someone_else")
        from fastapi.testclient import TestClient

        with TestClient(app) as client:
            resp = client.get("/api/bookings/1")
        assert resp.status_code == 200
