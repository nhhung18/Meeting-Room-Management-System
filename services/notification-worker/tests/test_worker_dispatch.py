"""Unit tests cho worker dispatch và idempotency."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _make_message(event_type: str, event_id: str = "evt-001", payload: dict | None = None):
    """Tạo mock aio_pika.IncomingMessage."""
    body = json.dumps({
        "event_id": event_id,
        "event_type": event_type,
        "timestamp": "2099-01-01T09:00:00+00:00",
        "payload": payload or {},
    }).encode()
    msg = MagicMock()
    msg.body = body
    msg.headers = {}
    # process() là async context manager
    ctx = AsyncMock()
    ctx.__aenter__ = AsyncMock(return_value=None)
    ctx.__aexit__ = AsyncMock(return_value=False)
    msg.process = MagicMock(return_value=ctx)
    return msg


@pytest.fixture
def mock_db():
    """Patch SessionLocal để không cần DB thật."""
    session = MagicMock()
    session.__enter__ = MagicMock(return_value=session)
    session.__exit__ = MagicMock(return_value=False)
    session.get = MagicMock(return_value=None)  # default: event chưa xử lý
    with patch("app.worker.SessionLocal", return_value=session) as mock_cls:
        yield mock_cls, session


@pytest.fixture
def mock_sender():
    with patch("app.worker.get_email_sender") as mock:
        sender = MagicMock()
        sender.send_booking_created = MagicMock()
        sender.send_booking_cancelled = MagicMock()
        sender.send_booking_checked_in = MagicMock()
        sender.send_booking_auto_cancelled = MagicMock()
        mock.return_value = sender
        yield sender


class TestHandleMessage:
    @pytest.mark.asyncio
    async def test_dispatches_booking_created_to_email_sender(self, mock_db, mock_sender):
        """booking.created gọi send_booking_created."""
        from app.worker import handle_message

        msg = _make_message("booking.created", payload={"booking_id": 1})
        await handle_message(msg)

        mock_sender.send_booking_created.assert_called_once_with({"booking_id": 1})

    @pytest.mark.asyncio
    async def test_dispatches_booking_cancelled(self, mock_db, mock_sender):
        """booking.cancelled gọi send_booking_cancelled."""
        from app.worker import handle_message

        msg = _make_message("booking.cancelled", payload={"booking_id": 2})
        await handle_message(msg)

        mock_sender.send_booking_cancelled.assert_called_once_with({"booking_id": 2})

    @pytest.mark.asyncio
    async def test_dispatches_booking_checked_in(self, mock_db, mock_sender):
        """booking.checked_in gọi send_booking_checked_in."""
        from app.worker import handle_message

        msg = _make_message("booking.checked_in", payload={"booking_id": 3})
        await handle_message(msg)

        mock_sender.send_booking_checked_in.assert_called_once_with({"booking_id": 3})

    @pytest.mark.asyncio
    async def test_dispatches_booking_auto_cancelled(self, mock_db, mock_sender):
        """booking.auto_cancelled gọi send_booking_auto_cancelled."""
        from app.worker import handle_message

        msg = _make_message("booking.auto_cancelled", payload={"booking_id": 4})
        await handle_message(msg)

        mock_sender.send_booking_auto_cancelled.assert_called_once_with({"booking_id": 4})

    @pytest.mark.asyncio
    async def test_idempotency_skips_duplicate_event_id(self, mock_db, mock_sender):
        """Cùng event_id lần 2 → email KHÔNG được gửi lại."""
        from app.models import ProcessedEvent
        from app.worker import handle_message

        mock_cls, session = mock_db
        # Giả lập: event đã được xử lý trước đó
        existing = ProcessedEvent(event_id="evt-dup")
        session.get = MagicMock(return_value=existing)

        msg = _make_message("booking.created", event_id="evt-dup", payload={"booking_id": 5})
        await handle_message(msg)

        mock_sender.send_booking_created.assert_not_called()

    @pytest.mark.asyncio
    async def test_unknown_event_type_logs_warning(self, mock_db, mock_sender, caplog):
        """Event type không biết → log warning, không crash."""
        import logging

        from app.worker import handle_message

        msg = _make_message("booking.unknown_event")
        with caplog.at_level(logging.WARNING, logger="worker"):
            await handle_message(msg)

        assert any("unknown" in r.message.lower() for r in caplog.records)
        # Không có email nào được gửi
        mock_sender.send_booking_created.assert_not_called()
