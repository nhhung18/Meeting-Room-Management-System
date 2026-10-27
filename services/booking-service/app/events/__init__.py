"""Event publishing module — lazy singleton EventPublisher."""

from __future__ import annotations

import logging

from app.events.publisher import EventPublisher

logger = logging.getLogger(__name__)

_publisher: EventPublisher | None = None


def get_publisher() -> EventPublisher:
    """Trả về singleton EventPublisher, khởi tạo lần đầu khi cần."""
    global _publisher
    if _publisher is None:
        from app.core.config import get_settings

        s = get_settings()
        _publisher = EventPublisher(s.rabbitmq_url, queue=s.notifications_queue)
    return _publisher
