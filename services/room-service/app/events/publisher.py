"""EventPublisher cho room-service — publish room lifecycle events tới RabbitMQ."""

import contextlib
import json
import logging
import uuid
from datetime import UTC, datetime

import pika

logger = logging.getLogger(__name__)


class EventPublisher:
    def __init__(self, rabbitmq_url: str, queue: str = "notifications") -> None:
        self._url = rabbitmq_url
        self._queue = queue
        self._connection: pika.BlockingConnection | None = None
        self._channel = None

    def _ensure_channel(self) -> bool:
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

    # Room lifecycle events are routed to room_events queue for booking-service consumer
    _ROOM_EVENTS_QUEUE = "room_events"
    _ROOM_LIFECYCLE_EVENTS = {"room.created", "room.updated", "room.deleted"}

    def _get_queue_for_event(self, event_type: str) -> str:
        if event_type in self._ROOM_LIFECYCLE_EVENTS:
            return self._ROOM_EVENTS_QUEUE
        return self._queue

    def publish(self, event_type: str, payload: dict, request_id: str | None = None) -> None:
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
            delivery_mode=2,
            headers=headers,
        )

        routing_key = self._get_queue_for_event(event_type)
        # Ensure the target queue exists (best-effort: already declared is fine)
        with contextlib.suppress(Exception):
            self._channel.queue_declare(queue=routing_key, durable=True)

        try:
            self._channel.basic_publish(
                exchange="",
                routing_key=routing_key,
                body=json.dumps(message),
                properties=props,
            )
        except Exception:
            logger.warning("failed to publish event %s", event_type, exc_info=True)
            self._connection = None
            self._channel = None

    def close(self) -> None:
        if self._connection and not self._connection.is_closed:
            with contextlib.suppress(Exception):
                self._connection.close()
        self._connection = None
        self._channel = None
