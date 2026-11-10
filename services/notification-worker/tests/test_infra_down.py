"""Test: PostgreSQL/RabbitMQ tạm thời không khả dụng — notification-worker (S5).

Proves:
1. DB down → handle_message requeues (first failure) or sends to DLQ (max retries)
2. RabbitMQ connection failure → run_worker raises (connect_robust fails)
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _make_message(event_type: str = "booking.created") -> MagicMock:
    body = json.dumps({
        "event_id": "evt-infra-test",
        "event_type": event_type,
        "payload": {"booking_id": 1},
    }).encode()

    msg = MagicMock()
    msg.body = body
    msg.ack = AsyncMock()
    msg.reject = AsyncMock()
    msg.headers = {}
    return msg


class TestDBDown:
    @pytest.mark.asyncio
    async def test_db_down_requeues_message(self):
        """DB unavailable → session raises → message requeued for retry."""
        from app.worker import handle_message

        session = MagicMock()
        session.__enter__ = MagicMock(side_effect=Exception("connection refused"))
        session.__exit__ = MagicMock(return_value=False)
        session_factory = MagicMock(return_value=session)

        msg = _make_message()

        with patch("app.worker.SessionLocal", session_factory), \
             patch("app.worker.get_email_sender", return_value=MagicMock()):
            await handle_message(msg)

        msg.reject.assert_called_once_with(requeue=True)
        msg.ack.assert_not_called()

    @pytest.mark.asyncio
    async def test_db_down_max_retries_sends_to_dlq(self):
        """DB unavailable + max retries reached → message goes to DLQ."""
        from app.worker import handle_message

        session = MagicMock()
        session.__enter__ = MagicMock(side_effect=Exception("connection refused"))
        session.__exit__ = MagicMock(return_value=False)
        session_factory = MagicMock(return_value=session)

        msg = _make_message()
        msg.headers = {"x-death": [{"count": 3, "queue": "notifications"}]}

        with patch("app.worker.SessionLocal", session_factory), \
             patch("app.worker.get_email_sender", return_value=MagicMock()):
            await handle_message(msg)

        msg.reject.assert_called_once_with(requeue=False)
        msg.ack.assert_not_called()


class TestRabbitMQDown:
    @pytest.mark.asyncio
    async def test_run_worker_fails_when_rabbitmq_down(self):
        """RabbitMQ unavailable → connect_robust raises ConnectionError."""
        from app.worker import run_worker

        with patch("app.worker.aio_pika.connect_robust",
                    new_callable=AsyncMock,
                    side_effect=ConnectionError("Connection refused")), \
             patch("app.worker.configure_logging"):
            with pytest.raises(ConnectionError, match="Connection refused"):
                await run_worker()
