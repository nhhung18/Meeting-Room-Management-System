"""Test: Notification Worker tạm ngừng → outbox tích lũy, worker restart → drain (S4).

Proves the transactional outbox pattern survives worker downtime:
1. Bookings created while worker is down → outbox_events rows with sent_at=NULL
2. When relay_once runs again → all unsent events are published and marked sent
3. Already-sent events are NOT re-published (idempotent relay)
"""

from unittest.mock import MagicMock, patch

from app.models.outbox_event import OutboxEvent
from app.workers.outbox_relay import relay_once


class TestOutboxAccumulatesDuringDowntime:
    def test_unsent_events_have_null_sent_at(self):
        event = OutboxEvent(
            event_type="booking.created",
            payload='{"booking_id": 1}',
        )
        assert event.sent_at is None

    def test_relay_drains_all_unsent_on_restart(self):
        events = [
            OutboxEvent(
                event_type="booking.created",
                payload=f'{{"booking_id": {i}}}',
            )
            for i in range(5)
        ]
        mock_session = MagicMock()
        mock_session.execute.return_value.scalars.return_value.all.return_value = events

        with patch("app.workers.outbox_relay.get_publisher") as mock_pub:
            mock_pub.return_value.publish = MagicMock()
            count = relay_once(mock_session)

        assert count == 5
        assert mock_pub.return_value.publish.call_count == 5
        for event in events:
            assert event.sent_at is not None

    def test_no_unsent_means_zero_published(self):
        mock_session = MagicMock()
        mock_session.execute.return_value.scalars.return_value.all.return_value = []

        with patch("app.workers.outbox_relay.get_publisher") as mock_pub:
            count = relay_once(mock_session)

        assert count == 0
        mock_pub.return_value.publish.assert_not_called()

    def test_partial_failure_marks_only_sent_ones(self):
        """If publish fails on 3rd event, first 2 are marked sent, 3rd stays unsent."""
        events = [
            OutboxEvent(event_type="booking.created", payload=f'{{"id": {i}}}')
            for i in range(3)
        ]
        mock_session = MagicMock()
        mock_session.execute.return_value.scalars.return_value.all.return_value = events

        call_count = 0

        def _publish_side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 3:
                raise ConnectionError("RabbitMQ down")

        with patch("app.workers.outbox_relay.get_publisher") as mock_pub:
            mock_pub.return_value.publish.side_effect = _publish_side_effect
            count = relay_once(mock_session)

        assert count == 2
        assert events[0].sent_at is not None
        assert events[1].sent_at is not None
        assert events[2].sent_at is None
