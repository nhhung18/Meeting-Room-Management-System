"""Unit tests cho retry counting và DLQ routing trong notification-worker."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _make_session_mock():
    session = MagicMock()
    session.__enter__ = MagicMock(return_value=session)
    session.__exit__ = MagicMock(return_value=False)
    session.get = MagicMock(return_value=None)
    return MagicMock(return_value=session)


def _make_message(event_type: str, payload: dict, x_death_count: int = 0) -> MagicMock:
    """Create mock IncomingMessage with optional x-death retry count."""
    body = json.dumps({
        "event_id": "evt-retry-test",
        "event_type": event_type,
        "payload": payload,
    }).encode()

    msg = MagicMock()
    msg.body = body
    msg.ack = AsyncMock()
    msg.reject = AsyncMock()

    if x_death_count > 0:
        msg.headers = {"x-death": [{"count": x_death_count, "queue": "notifications"}]}
    else:
        msg.headers = {}

    return msg


class TestGetRetryCount:
    @pytest.mark.asyncio
    async def test_get_retry_count_from_x_death(self):
        """_get_retry_count reads count from x-death header."""
        from app.worker import _get_retry_count

        msg = MagicMock()
        msg.headers = {"x-death": [{"count": 2, "queue": "notifications"}]}
        assert _get_retry_count(msg) == 2

    @pytest.mark.asyncio
    async def test_get_retry_count_zero_when_no_header(self):
        """No x-death header means 0 retries."""
        from app.worker import _get_retry_count

        msg = MagicMock()
        msg.headers = {}
        assert _get_retry_count(msg) == 0

    @pytest.mark.asyncio
    async def test_get_retry_count_zero_when_headers_none(self):
        """None headers means 0 retries."""
        from app.worker import _get_retry_count

        msg = MagicMock()
        msg.headers = None
        assert _get_retry_count(msg) == 0


class TestRetryDLQ:
    @pytest.mark.asyncio
    async def test_success_acks_message(self):
        """Successful processing acks the message."""
        from app.worker import handle_message

        msg = _make_message("booking.created", {"booking_id": 1})

        with patch("app.worker.SessionLocal", _make_session_mock()), \
             patch("app.worker.get_email_sender", return_value=MagicMock()):
            await handle_message(msg)

        msg.ack.assert_called_once()
        msg.reject.assert_not_called()

    @pytest.mark.asyncio
    async def test_first_failure_requeues(self):
        """First failure (no x-death): message is requeued."""
        from app.worker import handle_message

        mock_sender = MagicMock()
        mock_sender.send_booking_created.side_effect = Exception("smtp error")
        msg = _make_message("booking.created", {"booking_id": 1}, x_death_count=0)

        with patch("app.worker.SessionLocal", _make_session_mock()), \
             patch("app.worker.get_email_sender", return_value=mock_sender):
            await handle_message(msg)

        msg.reject.assert_called_once_with(requeue=True)
        msg.ack.assert_not_called()

    @pytest.mark.asyncio
    async def test_max_retries_sends_to_dlq(self):
        """After 3 failures: message is rejected without requeue (goes to DLQ)."""
        from app.worker import handle_message

        mock_sender = MagicMock()
        mock_sender.send_booking_created.side_effect = Exception("smtp error")
        msg = _make_message("booking.created", {"booking_id": 1}, x_death_count=3)

        with patch("app.worker.SessionLocal", _make_session_mock()), \
             patch("app.worker.get_email_sender", return_value=mock_sender):
            await handle_message(msg)

        msg.reject.assert_called_once_with(requeue=False)
        msg.ack.assert_not_called()

    @pytest.mark.asyncio
    async def test_idempotency_duplicate_acks_without_email(self):
        """Duplicate event: acked immediately without sending email."""
        from app.worker import handle_message

        session_factory = _make_session_mock()
        # Simulate already-processed event
        session_factory.return_value.get = MagicMock(return_value=object())
        msg = _make_message("booking.created", {"booking_id": 1})

        mock_sender = MagicMock()
        with patch("app.worker.SessionLocal", session_factory), \
             patch("app.worker.get_email_sender", return_value=mock_sender):
            await handle_message(msg)

        msg.ack.assert_called_once()
        mock_sender.send_booking_created.assert_not_called()
