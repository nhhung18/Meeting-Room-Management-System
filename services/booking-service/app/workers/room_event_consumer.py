"""Room event consumer — listens to room_events queue and keeps room_snapshots up-to-date."""

import json
import logging
import time

import pika

from app.repositories.room_snapshot_repository import RoomSnapshotRepository

logger = logging.getLogger(__name__)

_ROOM_EVENTS_QUEUE = "room_events"


def handle_room_event(event: dict, repo: RoomSnapshotRepository) -> None:
    """Process a single room lifecycle event and update the snapshot table."""
    event_type = event.get("event_type", "")
    payload = event.get("payload", {})

    if event_type in ("room.created", "room.updated"):
        repo.upsert(
            room_id=payload["room_id"],
            name=payload["name"],
            capacity=payload["capacity"],
            status=payload["status"],
            floor=payload.get("floor"),
            equipment=payload.get("equipment", []),
            owner_id=payload.get("owner_id"),
            version=payload.get("version", payload["room_id"]),
        )
    elif event_type == "room.deleted":
        repo.delete_by_room_id(payload["room_id"])
    else:
        logger.debug("room_event_consumer: ignoring unknown event_type=%s", event_type)


def run_forever(session_factory, rabbitmq_url: str, interval_reconnect: int = 5) -> None:
    logger.info("room event consumer starting", extra={"fields": {"queue": _ROOM_EVENTS_QUEUE}})

    while True:
        try:
            params = pika.URLParameters(rabbitmq_url)
            connection = pika.BlockingConnection(params)
            channel = connection.channel()
            channel.queue_declare(queue=_ROOM_EVENTS_QUEUE, durable=True)
            channel.basic_qos(prefetch_count=1)

            def callback(ch, method, properties, body):
                try:
                    event = json.loads(body)
                    with session_factory() as session:
                        repo = RoomSnapshotRepository(session)
                        handle_room_event(event, repo)
                        session.commit()
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                except Exception:
                    logger.exception("room_event_consumer: failed to handle message")
                    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

            channel.basic_consume(queue=_ROOM_EVENTS_QUEUE, on_message_callback=callback)
            logger.info("room event consumer ready")
            channel.start_consuming()

        except pika.exceptions.AMQPConnectionError:
            logger.warning(
                "room event consumer: rabbitmq unavailable, retrying in %ss", interval_reconnect
            )
            time.sleep(interval_reconnect)
        except Exception:
            logger.exception("room event consumer: unexpected error, retrying")
            time.sleep(interval_reconnect)


if __name__ == "__main__":
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.core.config import get_settings
    from app.core.logging import configure_logging

    settings = get_settings()
    configure_logging(settings.service_name, settings.log_level)

    engine = create_engine(settings.database_url)
    SessionFactory = sessionmaker(bind=engine)
    run_forever(SessionFactory, settings.rabbitmq_url)
