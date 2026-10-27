"""Auto-cancel worker — quét CONFIRMED bookings quá hạn và cancel chúng.

Chạy như standalone process riêng biệt (python -m app.workers.auto_cancel)
để đảm bảo chỉ có một instance cancel worker khi booking-service scale ngang.

Pattern:
  run_once(session): scan + cancel + commit một lần, trả về số lượng đã cancel.
  run_forever(session_factory, interval): loop gọi run_once mỗi interval giây.
"""

import json
import logging
import time
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.booking import BookingStatus
from app.models.outbox_event import OutboxEvent
from app.repositories.booking_repository import BookingRepository

logger = logging.getLogger(__name__)


def run_once(session: Session) -> int:
    """Scan và cancel tất cả CONFIRMED bookings đã quá cửa sổ check-in.

    Returns số lượng booking đã bị cancel trong lần chạy này.
    """
    cutoff = datetime.now(UTC)
    repo = BookingRepository(session)
    overdue = repo.find_overdue_confirmed(cutoff)

    if not overdue:
        return 0

    now = datetime.now(UTC)
    for booking in overdue:
        booking.status = BookingStatus.CANCELLED
        booking.auto_cancelled_at = now
        repo.update(booking)
        session.add(OutboxEvent(
            event_type="booking.auto_cancelled",
            payload=json.dumps({
                "booking_id": booking.id,
                "room_id": booking.room_id,
                "user_id": booking.user_id,
                "auto_cancelled_at": now.isoformat(),
            }),
        ))
        logger.info(
            "auto-cancelled booking",
            extra={"fields": {"booking_id": booking.id, "room_id": booking.room_id}},
        )

    session.commit()
    return len(overdue)


def run_forever(session_factory, interval_seconds: int = 60) -> None:
    """Loop gọi run_once mỗi interval_seconds giây."""
    logger.info("auto-cancel worker started", extra={"fields": {"interval": interval_seconds}})
    while True:
        try:
            with session_factory() as session:
                count = run_once(session)
            if count:
                logger.info("auto-cancel cycle done", extra={"fields": {"cancelled": count}})
        except Exception:
            logger.exception("auto-cancel cycle failed")
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
    run_forever(SessionFactory, interval_seconds=settings.auto_cancel_interval_seconds)
