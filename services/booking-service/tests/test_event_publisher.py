"""Unit tests cho EventPublisher — kiểm tra publish message lên RabbitMQ."""

import json
from unittest.mock import MagicMock, patch

import pytest

from app.events.publisher import EventPublisher


@pytest.fixture
def mock_pika():
    """Patch pika.BlockingConnection để không kết nối RabbitMQ thật."""
    with patch("app.events.publisher.pika") as mock:
        mock_conn = MagicMock()
        mock_channel = MagicMock()
        mock_conn.channel.return_value = mock_channel
        mock.BlockingConnection.return_value = mock_conn
        mock.ConnectionParameters.return_value = MagicMock()
        mock.BasicProperties.return_value = MagicMock()
        mock.URLParameters.return_value = MagicMock()
        yield mock, mock_channel


class TestEventPublisher:
    def test_publish_sends_message_to_queue(self, mock_pika):
        """publish() gửi message JSON lên queue với đúng event_type."""
        _, mock_channel = mock_pika
        publisher = EventPublisher("amqp://guest:guest@localhost/", queue="notifications")

        publisher.publish("booking.created", {"booking_id": 1})
        publisher.close()

        mock_channel.basic_publish.assert_called_once()
        call_kwargs = mock_channel.basic_publish.call_args
        # Body là JSON
        body = json.loads(call_kwargs.kwargs["body"])
        assert body["event_type"] == "booking.created"
        assert body["payload"]["booking_id"] == 1

    def test_publish_includes_event_id(self, mock_pika):
        """Message body phải có event_id dạng UUID."""
        import re

        _, mock_channel = mock_pika
        publisher = EventPublisher("amqp://guest:guest@localhost/")

        publisher.publish("booking.cancelled", {"booking_id": 2})
        publisher.close()

        body = json.loads(mock_channel.basic_publish.call_args.kwargs["body"])
        uuid_pattern = r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        assert re.match(uuid_pattern, body["event_id"])

    def test_publish_includes_timestamp(self, mock_pika):
        """Message body phải có timestamp ISO-8601."""
        _, mock_channel = mock_pika
        publisher = EventPublisher("amqp://guest:guest@localhost/")

        publisher.publish("booking.checked_in", {"booking_id": 3})
        publisher.close()

        body = json.loads(mock_channel.basic_publish.call_args.kwargs["body"])
        assert "timestamp" in body

    def test_publish_includes_request_id_header(self, mock_pika):
        """Khi truyền request_id, message header phải có X-Request-ID."""
        mock_module, mock_channel = mock_pika
        publisher = EventPublisher("amqp://guest:guest@localhost/")

        publisher.publish("booking.created", {"booking_id": 1}, request_id="req-123")
        publisher.close()

        # BasicProperties được gọi với headers chứa X-Request-ID
        mock_module.BasicProperties.assert_called_once()
        props_kwargs = mock_module.BasicProperties.call_args.kwargs
        assert props_kwargs["headers"]["X-Request-ID"] == "req-123"

    def test_publish_failure_logs_warning_no_raise(self):
        """Khi RabbitMQ không available, publish log warning và KHÔNG raise exception."""
        with patch("app.events.publisher.pika") as mock_pika:
            mock_pika.URLParameters.side_effect = Exception("connection refused")

            publisher = EventPublisher("amqp://guest:guest@localhost/")
            # Không raise — best-effort
            publisher.publish("booking.created", {"booking_id": 1})

    def test_publish_routes_to_correct_queue(self, mock_pika):
        """basic_publish phải dùng đúng routing_key là tên queue."""
        _, mock_channel = mock_pika
        publisher = EventPublisher("amqp://guest:guest@localhost/", queue="notifications")

        publisher.publish("booking.auto_cancelled", {"booking_id": 4})
        publisher.close()

        call_kwargs = mock_channel.basic_publish.call_args.kwargs
        assert call_kwargs["routing_key"] == "notifications"
