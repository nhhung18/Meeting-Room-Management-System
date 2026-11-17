"""Event publishing module cho room-service — lazy singleton EventPublisher."""

from __future__ import annotations

from app.events.publisher import EventPublisher

_publisher: EventPublisher | None = None


def get_publisher() -> EventPublisher:
    global _publisher
    if _publisher is None:
        from app.core.config import get_settings

        s = get_settings()
        _publisher = EventPublisher(s.rabbitmq_url, queue=s.notifications_queue)
    return _publisher
