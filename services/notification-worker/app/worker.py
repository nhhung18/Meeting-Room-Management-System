"""RabbitMQ consumer loop cho notification-worker.

Worker nhận message từ queue 'notifications', log message kèm request_id,
rồi ack. Tuần 5: thay phần log bằng gửi email/push thật sự.
"""

import asyncio
import json
import logging

import aio_pika

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.request_id import request_id_ctx, resolve_request_id

logger = logging.getLogger("worker")


async def handle_message(message: aio_pika.IncomingMessage) -> None:
    """Xử lý một notification message, đảm bảo ack dù có lỗi."""
    async with message.process():
        try:
            body = json.loads(message.body)
        except json.JSONDecodeError:
            logger.error(
                "invalid json payload, discarding",
                extra={"fields": {"body": message.body[:200]}},
            )
            return

        # Lấy request_id từ message header để trace xuyên service.
        raw_id = (message.headers or {}).get("X-Request-ID")
        request_id = resolve_request_id(raw_id)
        token = request_id_ctx.set(request_id)
        try:
            logger.info(
                "notification received",
                extra={
                    "fields": {
                        "event_type": body.get("event_type"),
                        "payload": body,
                    }
                },
            )
        finally:
            request_id_ctx.reset(token)


async def run_worker() -> None:
    settings = get_settings()
    configure_logging(settings.service_name, settings.log_level)

    logger.info("connecting to rabbitmq", extra={"fields": {"url": settings.rabbitmq_url}})
    connection = await aio_pika.connect_robust(settings.rabbitmq_url)

    async with connection:
        channel = await connection.channel()
        # prefetch=1: xử lý một message một lúc, tránh overload khi message nặng.
        await channel.set_qos(prefetch_count=1)

        queue = await channel.declare_queue(settings.notifications_queue, durable=True)
        logger.info("worker ready", extra={"fields": {"queue": settings.notifications_queue}})

        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                await handle_message(message)


if __name__ == "__main__":
    asyncio.run(run_worker())
