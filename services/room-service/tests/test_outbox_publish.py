from unittest.mock import MagicMock, patch

import pytest

from app.events.publisher import EventPublisher
from app.workers import outbox_relay


def test_publish_raises_when_broker_rejects_message():
    publisher = EventPublisher("amqp://guest:guest@rabbitmq:5672/")
    channel = MagicMock(is_closed=False)
    channel.basic_publish.side_effect = RuntimeError("broker closed")
    publisher._connection = MagicMock(is_closed=False)
    publisher._channel = channel

    with pytest.raises(RuntimeError):
        publisher.publish("room.created", {"room_id": 1})


def test_relay_leaves_event_unsent_when_publish_fails():
    event = MagicMock(
        id=1,
        event_type="room.created",
        payload='{"room_id": 1}',
        request_id=None,
        sent_at=None,
    )
    session = MagicMock()
    session.execute.return_value.scalars.return_value.all.return_value = [event]
    publisher = MagicMock()
    publisher.publish.side_effect = RuntimeError("broker closed")

    with patch.object(outbox_relay, "get_publisher", return_value=publisher):
        sent = outbox_relay.relay_once(session)

    assert sent == 0
    assert event.sent_at is None
