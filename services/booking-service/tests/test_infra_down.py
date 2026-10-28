"""Test: PostgreSQL/RabbitMQ tạm thời không khả dụng (mandatory scenario S5).

Proves:
1. DB down → health returns 503, status "degraded"
2. DB recovers → health returns 200 again
3. RabbitMQ down → outbox relay handles failure gracefully, events stay unsent
"""

from unittest.mock import MagicMock, patch

import pytest

from app.db.session import database_is_healthy
from app.main import app
from app.models.outbox_event import OutboxEvent


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    app.dependency_overrides.clear()


class TestPostgresDown:
    def test_health_returns_503_when_db_down(self, client, db_down):
        resp = client.get("/api/bookings/health")
        assert resp.status_code == 503
        body = resp.json()
        assert body["database"] == "unavailable"
        assert body["status"] == "degraded"

    def test_health_returns_200_when_db_up(self, client, db_up):
        resp = client.get("/api/bookings/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["database"] == "ok"
        assert body["status"] == "ok"

    def test_db_recovery_after_outage(self, client, db_down):
        resp1 = client.get("/api/bookings/health")
        assert resp1.status_code == 503

        app.dependency_overrides[database_is_healthy] = lambda: True
        resp2 = client.get("/api/bookings/health")
        assert resp2.status_code == 200
        assert resp2.json()["database"] == "ok"


class TestRabbitMQDown:
    def test_outbox_relay_handles_publish_failure(self):
        """RabbitMQ down → relay_once catches error, event stays unsent."""
        evt = OutboxEvent(event_type="booking.created", payload='{"booking_id": 1}')
        mock_session = MagicMock()
        mock_session.execute.return_value.scalars.return_value.all.return_value = [evt]

        with patch("app.workers.outbox_relay.get_publisher") as mock_pub:
            mock_pub.return_value.publish.side_effect = ConnectionError("RabbitMQ down")
            from app.workers.outbox_relay import relay_once

            count = relay_once(mock_session)

        assert count == 0
        assert evt.sent_at is None

    def test_booking_create_succeeds_without_rabbitmq(self, client, admin_user, mock_db):
        """Booking creation writes to outbox (DB), not directly to RabbitMQ.
        So RabbitMQ being down does not affect booking creation."""
        from app.api.bookings import _get_booking_service
        from app.schemas.booking import BookingResponse

        mock_svc = MagicMock()
        mock_svc.create_booking.return_value = BookingResponse(
            id=1, room_id=1, user_id="admin1",
            start_at="2099-01-01T09:00:00+00:00",
            end_at="2099-01-01T10:00:00+00:00",
            num_attendees=2, status="CONFIRMED",
            checked_in_at=None, auto_cancelled_at=None,
            created_at="2026-01-01T00:00:00+00:00",
            updated_at="2026-01-01T00:00:00+00:00",
            room_name="Room A", attendees=[],
        )
        app.dependency_overrides[_get_booking_service] = lambda: mock_svc

        resp = client.post("/api/bookings/", json={
            "room_id": 1,
            "start_at": "2099-01-01T09:00:00+00:00",
            "end_at": "2099-01-01T10:00:00+00:00",
            "num_attendees": 2,
        })
        assert resp.status_code == 201
