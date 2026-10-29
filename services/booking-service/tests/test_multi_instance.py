"""Test: Service chạy nhiều instance sau load balancer (mandatory scenario S7).

Proves multi-instance support:
1. Health endpoint includes hostname → load balancer can distinguish instances
2. Overlap detection at service level → each instance rejects double-bookings
3. Booking creation with overlap returns 409 via API layer (IntegrityError mapping)

S1 (EXCLUDE constraint under real concurrency) is covered in integration/test_concurrency.py.
This file covers the unit-level guarantees that make multi-instance safe.
"""

import socket
from unittest.mock import MagicMock

import pytest

from app.main import app


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    app.dependency_overrides.clear()


class TestHealthInstanceIdentification:
    def test_health_includes_hostname(self, client, db_up):
        resp = client.get("/api/bookings/health")
        assert resp.status_code == 200
        body = resp.json()
        assert "hostname" in body
        assert body["hostname"] == socket.gethostname()

    def test_health_includes_service_name(self, client, db_up):
        resp = client.get("/api/bookings/health")
        body = resp.json()
        assert "service" in body
        assert body["service"] == "booking-service"


class TestOverlapDetection:
    def test_service_rejects_overlap(self):
        """BookingService.create_booking raises OverlapError when has_overlap=True."""
        from app.services.booking_service import BookingService

        mock_booking_repo = MagicMock()
        mock_snapshot_repo = MagicMock()
        mock_snapshot = MagicMock(status="AVAILABLE", capacity=10, name="Room A")
        mock_snapshot_repo.get_by_room_id.return_value = mock_snapshot
        mock_booking_repo.has_overlap.return_value = True

        svc = BookingService(mock_booking_repo, mock_snapshot_repo)

        from app.schemas.booking import BookingCreate

        dto = BookingCreate(
            room_id=1,
            start_at="2099-01-01T09:00:00+00:00",
            end_at="2099-01-01T10:00:00+00:00",
            num_attendees=2,
        )

        with pytest.raises(BookingService.OverlapError):
            svc.create_booking(dto, user_id="user1")

    def test_api_returns_409_on_integrity_error(self, client, mock_db, admin_user):
        """IntegrityError from DB constraint → API returns 409 Conflict."""
        from sqlalchemy.exc import IntegrityError

        from app.api.bookings import _get_booking_service

        mock_svc = MagicMock()
        mock_svc.create_booking.side_effect = IntegrityError(
            "INSERT", {}, Exception("EXCLUDE constraint violation")
        )
        app.dependency_overrides[_get_booking_service] = lambda: mock_svc

        resp = client.post("/api/bookings/", json={
            "room_id": 1,
            "start_at": "2099-01-01T09:00:00+00:00",
            "end_at": "2099-01-01T10:00:00+00:00",
            "num_attendees": 2,
        })
        assert resp.status_code == 409
        assert "conflict" in resp.json()["detail"].lower()


class TestNginxRateLimitConfig:
    def test_nginx_config_has_rate_limit(self):
        """Verify nginx config includes rate limiting directives."""
        import pathlib

        nginx_conf = pathlib.Path(__file__).resolve().parents[3] / "infra" / "nginx" / "nginx.conf"
        content = nginx_conf.read_text()
        assert "limit_req_zone" in content
        assert "limit_req " in content
        assert "429" in content
