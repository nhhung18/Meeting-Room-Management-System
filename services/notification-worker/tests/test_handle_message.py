"""Unit tests cho handle_message logic mà không cần kết nối RabbitMQ thật.

Dùng mock để giả lập IncomingMessage của aio_pika.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _make_session_mock():
    """Tạo mock SessionLocal trả về context manager giả."""
    session = MagicMock()
    session.__enter__ = MagicMock(return_value=session)
    session.__exit__ = MagicMock(return_value=False)
    session.get = MagicMock(return_value=None)
    return MagicMock(return_value=session)


def _make_message(body: dict | str, headers: dict | None = None) -> MagicMock:
    """Tạo mock IncomingMessage với body JSON và headers tuỳ chọn."""
    if isinstance(body, dict):
        raw = json.dumps(body).encode()
    else:
        raw = body.encode() if isinstance(body, str) else body

    msg = MagicMock()
    msg.body = raw
    msg.headers = headers or {}
    msg.ack = AsyncMock()
    msg.reject = AsyncMock()
    return msg


@pytest.mark.asyncio
async def test_valid_message_logged(caplog):
    """handle_message log 'notification received' khi nhận message JSON hợp lệ."""
    import logging

    from app.worker import handle_message

    msg = _make_message({
        "event_id": "evt-test-001",
        "event_type": "booking.created",
        "payload": {"booking_id": "abc-123", "attendees": []},
    })

    with patch("app.worker.SessionLocal", _make_session_mock()), \
         patch("app.worker.get_email_sender", return_value=MagicMock()):
        with caplog.at_level(logging.INFO, logger="worker"):
            await handle_message(msg)

    assert any("notification received" in r.message for r in caplog.records)


@pytest.mark.asyncio
async def test_request_id_propagated(caplog):
    """handle_message truyền X-Request-ID từ header vào request_id_ctx."""
    import logging

    from app.core.request_id import request_id_ctx
    from app.worker import handle_message

    test_rid = "test-request-id-001"
    msg = _make_message(
        {
            "event_id": "evt-test-002",
            "event_type": "booking.cancelled",
            "payload": {},
        },
        headers={"X-Request-ID": test_rid},
    )

    captured_ids: list[str] = []

    original_info = logging.getLogger("worker").info

    def capturing_info(msg_text, *args, **kwargs):
        captured_ids.append(request_id_ctx.get(""))
        return original_info(msg_text, *args, **kwargs)

    with patch("app.worker.SessionLocal", _make_session_mock()), \
         patch("app.worker.get_email_sender", return_value=MagicMock()):
        with patch.object(logging.getLogger("worker"), "info", side_effect=capturing_info):
            await handle_message(msg)

    assert test_rid in captured_ids


@pytest.mark.asyncio
async def test_invalid_json_discarded(caplog):
    """handle_message không crash khi body không phải JSON hợp lệ."""
    import logging

    from app.worker import handle_message

    msg = _make_message("not-json-at-all")

    with caplog.at_level(logging.ERROR, logger="worker"):
        await handle_message(msg)

    assert any("invalid json" in r.message for r in caplog.records)
