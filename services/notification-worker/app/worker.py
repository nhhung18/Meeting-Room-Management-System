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


def _get_retry_count(message: aio_pika.IncomingMessage) -> int:
    """Read retry count from RabbitMQ x-death header.

    RabbitMQ populates x-death as a list of dicts, each with a 'count' key,
    when a message is dead-lettered. We sum counts for the main notifications
    queue to track total delivery attempts.
    """
    headers = message.headers or {}
    x_death = headers.get("x-death") or []
    total = 0
    for entry in x_death:
        total += entry.get("count", 0)
    return total


async def handle_message(message: aio_pika.IncomingMessage) -> None:
    """Xử lý notification message: idempotency check → dispatch email → ack/nack."""
    try:
        body = json.loads(message.body)
    except json.JSONDecodeError:
        logger.error(
            "invalid json payload, discarding",
            extra={"fields": {"body": message.body[:200]}},
        )
        await message.reject(requeue=False)
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
                await message.ack()
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
        await message.ack()

    except Exception:
        settings = get_settings()
        retry_count = _get_retry_count(message)
        if retry_count >= settings.max_retries:
            logger.error(
                "max retries exceeded, routing to DLQ",
                extra={"fields": {"event_id": body.get("event_id"), "retries": retry_count}},
                exc_info=True,
            )
            await message.reject(requeue=False)
        else:
            logger.warning(
                "message processing failed, requeueing",
                extra={"fields": {"event_id": body.get("event_id"), "retries": retry_count}},
                exc_info=True,
            )
            await message.reject(requeue=True)
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

        # Declare main queue with dead-letter routing to DLQ
        queue = await channel.declare_queue(
            settings.notifications_queue,
            durable=True,
            arguments={
                "x-dead-letter-exchange": "",
                "x-dead-letter-routing-key": settings.dlq_queue,
            },
        )
        # Declare DLQ so messages have somewhere to land
        await channel.declare_queue(settings.dlq_queue, durable=True)

        logger.info("worker ready", extra={"fields": {"queue": settings.notifications_queue}})

        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                await handle_message(message)


if __name__ == "__main__":
    asyncio.run(run_worker())
