"""Outbox relay worker — đọc outbox_events chưa gửi và publish lên RabbitMQ.

Pattern:
  relay_once(session): scan unsent events, publish, mark sent. Returns count sent.
  cleanup_old(session, days): delete sent events older than N days. Returns count deleted.
  run_forever(session_factory, interval): loop calling relay_once + cleanup_old.
"""

import json
import logging
import time
from datetime import UTC, datetime, timedelta

import sqlalchemy as sa
from sqlalchemy.orm import Session

from app.events import get_publisher
from app.models.outbox_event import OutboxEvent

logger = logging.getLogger(__name__)

_BATCH_SIZE = 100


def relay_once(session: Session) -> int:
    """Publish unsent outbox events to RabbitMQ and mark them sent.

    Returns the number of events successfully published.
    """
    stmt = (
        sa.select(OutboxEvent)
        .where(OutboxEvent.sent_at.is_(None))
        .order_by(OutboxEvent.created_at)
        .limit(_BATCH_SIZE)
    )
    events = session.execute(stmt).scalars().all()

    if not events:
        return 0

    publisher = get_publisher()
    sent_count = 0
    for evt in events:
        try:
            publisher.publish(
                evt.event_type,
                json.loads(evt.payload),
                request_id=evt.request_id,
            )
            evt.sent_at = datetime.now(UTC)
            sent_count += 1
        except Exception:
            logger.warning(
                "outbox relay: failed to publish event, will retry next cycle",
                extra={"fields": {"event_id": evt.id, "event_type": evt.event_type}},
                exc_info=True,
            )

    session.flush()
    return sent_count


def cleanup_old(session: Session, days: int = 7) -> int:
    """Delete sent outbox events older than N days. Returns count deleted."""
    cutoff = datetime.now(UTC) - timedelta(days=days)
    stmt = sa.delete(OutboxEvent).where(
        OutboxEvent.sent_at.isnot(None),
        OutboxEvent.sent_at < cutoff,
    )
    result = session.execute(stmt)
    return result.rowcount


def run_forever(session_factory, interval_seconds: int = 5) -> None:
    """Loop calling relay_once + cleanup_old every interval_seconds."""
    logger.info("outbox relay started", extra={"fields": {"interval": interval_seconds}})
    while True:
        try:
            with session_factory() as session:
                sent = relay_once(session)
                cleanup_old(session)
                session.commit()
            if sent:
                logger.info("outbox relay cycle done", extra={"fields": {"sent": sent}})
        except Exception:
            logger.exception("outbox relay cycle failed")
        time.sleep(interval_seconds)


if __name__ == "__main__":
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.core.config import get_settings
    from app.core.logging import configure_logging

    settings = get_settings()
    configure_logging(settings.service_name, settings.log_level)

    engine = create_engine(settings.database_url)
    SessionFactory = sessionmaker(bind=engine)
    run_forever(SessionFactory, interval_seconds=settings.outbox_relay_interval_seconds)
