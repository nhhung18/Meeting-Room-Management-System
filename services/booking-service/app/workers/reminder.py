"""Reminder worker — gửi thông báo nhắc nhở trước khi cuộc họp bắt đầu.

Pattern:
  run_once(session): scan CONFIRMED bookings sắp bắt đầu, ghi outbox event, đánh dấu đã gửi.
  run_forever(session_factory, interval): loop gọi run_once mỗi interval giây.

Lead time mặc định: 15 phút (configurable qua REMINDER_LEAD_MINUTES).
"""

import json
import logging
import time
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.outbox_event import OutboxEvent
from app.repositories.booking_repository import BookingRepository

logger = logging.getLogger(__name__)

REMINDER_LEAD_MINUTES = 15


def run_once(session: Session, lead_minutes: int = REMINDER_LEAD_MINUTES) -> int:
    """Scan và gửi nhắc nhở cho các booking sắp bắt đầu.

    Returns số booking đã gửi nhắc nhở.
    """
    now = datetime.now(UTC)
    repo = BookingRepository(session)
    upcoming = repo.find_needing_reminder(now, lead_minutes=lead_minutes)

    if not upcoming:
        return 0

    for booking in upcoming:
        session.add(
            OutboxEvent(
                event_type="booking.reminder",
                payload=json.dumps(
                    {
                        "booking_id": booking.id,
                        "room_id": booking.room_id,
                        "user_id": booking.user_id,
                        "booker_email": booking.booker_email,
                        "start_at": booking.start_at.isoformat(),
                        "end_at": booking.end_at.isoformat(),
                        "attendees": [
                            {"email": a.attendee_email, "name": a.name} for a in booking.attendees
                        ],
                    }
                ),
            )
        )
        booking.reminder_sent_at = now
        repo.update(booking)
        logger.info(
            "reminder queued",
            extra={"fields": {"booking_id": booking.id, "start_at": booking.start_at.isoformat()}},
        )

    session.commit()
    return len(upcoming)


def run_forever(session_factory, interval_seconds: int = 60) -> None:
    """Loop gọi run_once mỗi interval_seconds giây."""
    logger.info("reminder worker started", extra={"fields": {"interval": interval_seconds}})
    while True:
        try:
            with session_factory() as session:
                count = run_once(session)
            if count:
                logger.info("reminder cycle done", extra={"fields": {"sent": count}})
        except Exception:
            logger.exception("reminder cycle failed")
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
    run_forever(SessionFactory, interval_seconds=60)
