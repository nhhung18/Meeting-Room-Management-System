"""EventPublisher — gửi booking lifecycle events tới RabbitMQ.

Dùng pika (sync) vì booking-service là synchronous FastAPI.
Publish là best-effort: nếu RabbitMQ down, log warning và tiếp tục.
Publish chỉ xảy ra SAU db.commit() trong router — không bao giờ trong service layer.
"""

import contextlib
import json
import logging
import uuid
from datetime import UTC, datetime

import pika

logger = logging.getLogger(__name__)


class EventPublisher:
    """Gửi JSON events tới RabbitMQ queue.

    Connection được tạo lazy khi publish đầu tiên. Nếu connection fail,
    publish log warning và không raise.
    """

    def __init__(self, rabbitmq_url: str, queue: str = "notifications") -> None:
        self._url = rabbitmq_url
        self._queue = queue
        self._connection: pika.BlockingConnection | None = None
        self._channel = None

    def _ensure_channel(self) -> bool:
        """Đảm bảo connection và channel đang mở. Returns True nếu thành công."""
        try:
            if self._connection is None or self._connection.is_closed:
                params = pika.URLParameters(self._url)
                self._connection = pika.BlockingConnection(params)
            if self._channel is None or self._channel.is_closed:
                self._channel = self._connection.channel()
                self._channel.queue_declare(queue=self._queue, durable=True)
            return True
        except Exception:
            logger.warning("rabbitmq unavailable, skipping event publish", exc_info=True)
            self._connection = None
            self._channel = None
            return False

    def publish(
        self,
        event_type: str,
        payload: dict,
        request_id: str | None = None,
    ) -> None:
        """Publish một event tới queue. Best-effort — không raise khi RabbitMQ down."""
        if not self._ensure_channel():
            return

        message = {
            "event_id": str(uuid.uuid4()),
            "event_type": event_type,
            "timestamp": datetime.now(UTC).isoformat(),
            "payload": payload,
        }
        headers = {}
        if request_id:
            headers["X-Request-ID"] = request_id

        props = pika.BasicProperties(
            content_type="application/json",
            delivery_mode=2,  # persistent
            headers=headers,
        )

        try:
            self._channel.basic_publish(
                exchange="",
                routing_key=self._queue,
                body=json.dumps(message),
                properties=props,
            )
        except Exception:
            logger.warning("failed to publish event %s", event_type, exc_info=True)
            self._connection = None
            self._channel = None

    def close(self) -> None:
        """Đóng connection (dùng khi shutdown)."""
        if self._connection and not self._connection.is_closed:
            with contextlib.suppress(Exception):
                self._connection.close()
        self._connection = None
        self._channel = None
