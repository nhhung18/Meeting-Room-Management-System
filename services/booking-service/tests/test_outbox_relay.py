"""Unit tests cho outbox relay worker."""

from unittest.mock import MagicMock, patch

from app.models.outbox_event import OutboxEvent

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_session(*events: OutboxEvent):
    """Create a fake SQLAlchemy session backed by an in-memory list."""
    session = MagicMock()
    added: list[OutboxEvent] = []

    def _execute(stmt, **kwargs):
        result = MagicMock()
        # Handle SELECT unsent
        unsent = [e for e in list(events) + added if e.sent_at is None]
        result.scalars.return_value.all.return_value = unsent
        # Handle DELETE: return deleted count (filter by sent_at < cutoff)
        return result

    session.execute.side_effect = _execute
    session.add.side_effect = lambda e: added.append(e)
    session.flush.return_value = None
    return session, added


# ---------------------------------------------------------------------------
# relay_once tests
# ---------------------------------------------------------------------------


class TestRelayOnce:
    def test_publishes_unsent_events_and_marks_sent(self):
        """relay_once picks unsent OutboxEvent rows, publishes via EventPublisher, sets sent_at."""
        from app.workers.outbox_relay import relay_once

        mock_publisher = MagicMock()
        evt = OutboxEvent(event_type="booking.created", payload='{"booking_id":1}')
        session = MagicMock()
        session.execute.return_value.scalars.return_value.all.return_value = [evt]

        with patch("app.workers.outbox_relay.get_publisher", return_value=mock_publisher):
            count = relay_once(session)

        assert count == 1
        assert evt.sent_at is not None
        mock_publisher.publish.assert_called_once()

    def test_skips_already_sent(self):
        """Events with sent_at set are not re-published."""
        from app.workers.outbox_relay import relay_once

        mock_publisher = MagicMock()
        session = MagicMock()
        # relay_once queries WHERE sent_at IS NULL — returns empty (DB filtered out sent events)
        session.execute.return_value.scalars.return_value.all.return_value = []

        with patch("app.workers.outbox_relay.get_publisher", return_value=mock_publisher):
            count = relay_once(session)

        assert count == 0
        mock_publisher.publish.assert_not_called()

    def test_publish_failure_leaves_unsent(self):
        """If EventPublisher raises, sent_at stays None — will retry next cycle."""
        from app.workers.outbox_relay import relay_once

        mock_publisher = MagicMock()
        mock_publisher.publish.side_effect = Exception("rabbitmq down")
        evt = OutboxEvent(event_type="booking.cancelled", payload="{}")
        session = MagicMock()
        session.execute.return_value.scalars.return_value.all.return_value = [evt]

        with patch("app.workers.outbox_relay.get_publisher", return_value=mock_publisher):
            count = relay_once(session)

        assert count == 0
        assert evt.sent_at is None

    def test_publishes_with_request_id_header(self):
        """relay_once passes request_id to publisher."""
        from app.workers.outbox_relay import relay_once

        mock_publisher = MagicMock()
        evt = OutboxEvent(
            event_type="booking.created",
            payload='{"booking_id":2}',
            request_id="req-abc",
        )
        session = MagicMock()
        session.execute.return_value.scalars.return_value.all.return_value = [evt]

        with patch("app.workers.outbox_relay.get_publisher", return_value=mock_publisher):
            relay_once(session)

        call_kwargs = mock_publisher.publish.call_args
        assert call_kwargs.kwargs.get("request_id") == "req-abc" or (
            len(call_kwargs.args) >= 3 and call_kwargs.args[2] == "req-abc"
        )


# ---------------------------------------------------------------------------
# cleanup_old tests
# ---------------------------------------------------------------------------


class TestCleanupOld:
    def test_cleanup_deletes_old_sent_events(self):
        """cleanup_old deletes sent events older than N days."""
        from app.workers.outbox_relay import cleanup_old

        session = MagicMock()
        session.execute.return_value.rowcount = 1

        deleted = cleanup_old(session, days=7)
        assert deleted == 1
        session.execute.assert_called_once()
