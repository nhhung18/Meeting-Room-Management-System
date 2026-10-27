"""RabbitMQ consumer loop cho notification-worker."""

import asyncio
import json
import logging

import aio_pika

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.request_id import request_id_ctx, resolve_request_id

logger = logging.getLogger("worker")

# Lazy-initialised — patched in tests
SessionLocal = None  # type: ignore[assignment]
_email_sender = None


def _init_db() -> None:
    global SessionLocal
    from app.db import get_session_factory
    SessionLocal = get_session_factory()


def get_email_sender():
    global _email_sender
    if _email_sender is None:
        from app.email_sender import EmailSender
        s = get_settings()
        _email_sender = EmailSender(
            s.smtp_host, s.smtp_port, s.smtp_user, s.smtp_password, s.smtp_from_email
        )
    return _email_sender


async def handle_message(message: aio_pika.IncomingMessage) -> None:
    """Xử lý notification message: idempotency check → dispatch email → mark processed."""
    async with message.process(requeue=True):
        try:
            body = json.loads(message.body)
        except json.JSONDecodeError:
            logger.error(
                "invalid json payload, discarding",
                extra={"fields": {"body": message.body[:200]}},
            )
            return

        raw_id = (message.headers or {}).get("X-Request-ID")
        request_id = resolve_request_id(raw_id)
        token = request_id_ctx.set(request_id)

        try:
            event_id = body.get("event_id")
            event_type = body.get("event_type")
            payload = body.get("payload", {})

            # Idempotency check
            from app.models import ProcessedEvent
            with SessionLocal() as session:
                existing = session.get(ProcessedEvent, event_id)
                if existing:
                    logger.info(
                        "duplicate event, skipping",
                        extra={"fields": {"event_id": event_id}},
                    )
                    return

            # Dispatch to email sender
            sender = get_email_sender()
            dispatch = {
                "booking.created": sender.send_booking_created,
                "booking.cancelled": sender.send_booking_cancelled,
                "booking.checked_in": sender.send_booking_checked_in,
                "booking.auto_cancelled": sender.send_booking_auto_cancelled,
            }
            handler = dispatch.get(event_type)
            if handler:
                handler(payload)
            else:
                logger.warning(
                    "unknown event type, skipping",
                    extra={"fields": {"event_type": event_type}},
                )

            # Mark as processed
            with SessionLocal() as session:
                session.add(ProcessedEvent(event_id=event_id))
                session.commit()

            logger.info(
                "notification received",
                extra={"fields": {"event_type": event_type, "event_id": event_id}},
            )
        finally:
            request_id_ctx.reset(token)


async def run_worker() -> None:
    settings = get_settings()
    configure_logging(settings.service_name, settings.log_level)

    if settings.database_url:
        _init_db()

    logger.info("connecting to rabbitmq", extra={"fields": {"url": settings.rabbitmq_url}})
    connection = await aio_pika.connect_robust(settings.rabbitmq_url)

    async with connection:
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=1)

        queue = await channel.declare_queue(settings.notifications_queue, durable=True)
        logger.info("worker ready", extra={"fields": {"queue": settings.notifications_queue}})

        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                await handle_message(message)


if __name__ == "__main__":
    asyncio.run(run_worker())
