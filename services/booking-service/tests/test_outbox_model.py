"""Unit tests cho OutboxEvent model."""

from app.models.outbox_event import OutboxEvent


class TestOutboxEvent:
    def test_outbox_event_has_expected_tablename(self):
        assert OutboxEvent.__tablename__ == "outbox_events"

    def test_outbox_event_columns(self):
        cols = {c.name for c in OutboxEvent.__table__.columns}
        assert cols == {"id", "event_type", "payload", "created_at", "sent_at", "request_id"}

    def test_sent_at_defaults_to_none(self):
        evt = OutboxEvent(event_type="booking.created", payload='{"booking_id": 1}')
        assert evt.sent_at is None
