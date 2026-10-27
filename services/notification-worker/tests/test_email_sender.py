"""Unit tests cho EmailSender."""

from unittest.mock import MagicMock, patch

import pytest

from app.email_sender import EmailSender


@pytest.fixture
def mock_smtp():
    with patch("app.email_sender.smtplib.SMTP") as mock:
        mock_instance = MagicMock()
        mock.return_value.__enter__ = lambda s: mock_instance
        mock.return_value.__exit__ = MagicMock(return_value=False)
        yield mock, mock_instance


class TestEmailSender:
    def test_send_booking_created_calls_smtp(self, mock_smtp):
        """Gửi email đến tất cả attendees khi booking được tạo."""
        mock_cls, mock_conn = mock_smtp
        sender = EmailSender("smtp.test", 587, "user", "pass", "noreply@mrms.local")

        sender.send_booking_created({
            "booking_id": 1,
            "room_id": 10,
            "start_at": "2099-01-01T09:00:00+00:00",
            "end_at": "2099-01-01T10:00:00+00:00",
            "attendees": [
                {"email": "alice@test.com", "name": "Alice"},
                {"email": "bob@test.com", "name": "Bob"},
            ],
        })

        mock_conn.sendmail.assert_called_once()
        call_args = mock_conn.sendmail.call_args
        assert call_args.args[0] == "noreply@mrms.local"
        # Gửi tới cả 2 attendees
        assert set(call_args.args[1]) == {"alice@test.com", "bob@test.com"}

    def test_dev_mode_logs_instead_of_sending(self, caplog):
        """Khi smtp_host rỗng, log nội dung email thay vì gửi."""
        import logging
        sender = EmailSender("", 587, "", "", "noreply@mrms.local")

        with caplog.at_level(logging.INFO, logger="app.email_sender"):
            sender.send_booking_created({
                "booking_id": 1,
                "room_id": 10,
                "start_at": "2099-01-01T09:00:00+00:00",
                "end_at": "2099-01-01T10:00:00+00:00",
                "attendees": [{"email": "alice@test.com", "name": "Alice"}],
            })

        assert any("dev mode" in r.message.lower() for r in caplog.records)

    def test_dev_mode_does_not_call_smtp(self):
        """Khi smtp_host rỗng, không tạo SMTP connection."""
        with patch("app.email_sender.smtplib.SMTP") as mock_smtp_cls:
            sender = EmailSender("", 587, "", "", "noreply@mrms.local")
            sender.send_booking_cancelled({"booking_id": 2, "room_id": 10, "user_id": "u1"})
            mock_smtp_cls.assert_not_called()

    def test_send_booking_cancelled_calls_smtp(self, mock_smtp):
        """Gửi email thông báo hủy booking."""
        mock_cls, mock_conn = mock_smtp
        sender = EmailSender("smtp.test", 587, "user", "pass", "noreply@mrms.local")

        sender.send_booking_cancelled({
            "booking_id": 2,
            "room_id": 10,
            "user_id": "u1",
            "user_email": "user@test.com",
        })

        mock_conn.sendmail.assert_called_once()

    def test_send_booking_checked_in_calls_smtp(self, mock_smtp):
        """Gửi email xác nhận check-in."""
        mock_cls, mock_conn = mock_smtp
        sender = EmailSender("smtp.test", 587, "user", "pass", "noreply@mrms.local")

        sender.send_booking_checked_in({
            "booking_id": 3,
            "room_id": 10,
            "user_id": "u1",
            "user_email": "user@test.com",
            "checked_in_at": "2099-01-01T09:05:00+00:00",
        })

        mock_conn.sendmail.assert_called_once()

    def test_send_booking_auto_cancelled_calls_smtp(self, mock_smtp):
        """Gửi email thông báo hủy tự động."""
        mock_cls, mock_conn = mock_smtp
        sender = EmailSender("smtp.test", 587, "user", "pass", "noreply@mrms.local")

        sender.send_booking_auto_cancelled({
            "booking_id": 4,
            "room_id": 10,
            "user_id": "u1",
            "user_email": "user@test.com",
            "auto_cancelled_at": "2099-01-01T09:16:00+00:00",
        })

        mock_conn.sendmail.assert_called_once()

    def test_send_no_attendees_skips_smtp(self, mock_smtp):
        """Khi không có attendees, không gửi email."""
        mock_cls, mock_conn = mock_smtp
        sender = EmailSender("smtp.test", 587, "user", "pass", "noreply@mrms.local")

        sender.send_booking_created({
            "booking_id": 5,
            "room_id": 10,
            "start_at": "2099-01-01T09:00:00+00:00",
            "end_at": "2099-01-01T10:00:00+00:00",
            "attendees": [],
        })

        mock_conn.sendmail.assert_not_called()
