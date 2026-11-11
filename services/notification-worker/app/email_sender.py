"""EmailSender — gửi email thông báo booking lifecycle qua SMTP.

Dev mode: khi smtp_host rỗng, log nội dung email thay vì gửi thật.
"""

import logging
import smtplib
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


class EmailSender:
    def __init__(
        self,
        smtp_host: str,
        smtp_port: int,
        smtp_user: str,
        smtp_password: str,
        from_email: str,
    ) -> None:
        self._host = smtp_host
        self._port = smtp_port
        self._user = smtp_user
        self._password = smtp_password
        self._from = from_email

    def _send(self, to_emails: list[str], subject: str, body: str) -> None:
        if not to_emails:
            return
        if not self._host:
            logger.info(
                "dev mode: email not sent",
                extra={"fields": {"to": to_emails, "subject": subject}},
            )
            return
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = self._from
        msg["To"] = ", ".join(to_emails)
        with smtplib.SMTP(self._host, self._port) as conn:
            conn.starttls()
            if self._user:
                conn.login(self._user, self._password)
            conn.sendmail(self._from, to_emails, msg.as_string())

    def send_booking_created(self, payload: dict) -> None:
        attendees = payload.get("attendees", [])
        to = [a["email"] for a in attendees if a.get("email")]
        subject = f"Booking Confirmed — Room {payload.get('room_id')}"
        body = (
            f"Your booking (ID: {payload.get('booking_id')}) is confirmed.\n"
            f"Room: {payload.get('room_id')}\n"
            f"From: {payload.get('start_at')}\n"
            f"To:   {payload.get('end_at')}\n"
        )
        self._send(to, subject, body)

    def send_booking_cancelled(self, payload: dict) -> None:
        # Gửi tới user_id (email không có trong payload cancel — log user_id)
        logger.info(
            "booking cancelled notification",
            extra={"fields": {"booking_id": payload.get("booking_id")}},
        )
        subject = f"Booking Cancelled — ID {payload.get('booking_id')}"
        body = (
            f"Your booking (ID: {payload.get('booking_id')}) has been cancelled.\n"
            f"Room: {payload.get('room_id')}\n"
        )
        to = [payload["booker_email"]] if payload.get("booker_email") else []
        self._send(to, subject, body)

    def send_booking_checked_in(self, payload: dict) -> None:
        subject = f"Check-in Confirmed — Booking ID {payload.get('booking_id')}"
        body = (
            f"You have successfully checked in (ID: {payload.get('booking_id')}).\n"
            f"Checked in at: {payload.get('checked_in_at')}\n"
        )
        to = [payload["booker_email"]] if payload.get("booker_email") else []
        self._send(to, subject, body)

    def send_booking_auto_cancelled(self, payload: dict) -> None:
        subject = f"Booking Auto-Cancelled — ID {payload.get('booking_id')}"
        body = (
            f"Your booking (ID: {payload.get('booking_id')}) was automatically cancelled\n"
            f"because no check-in was recorded within 15 minutes of the start time.\n"
            f"Cancelled at: {payload.get('auto_cancelled_at')}\n"
        )
        to = [payload["booker_email"]] if payload.get("booker_email") else []
        self._send(to, subject, body)

    def send_booking_updated(self, payload: dict) -> None:
        attendees = payload.get("attendees", [])
        to_set = {a["email"] for a in attendees if a.get("email")}
        if payload.get("booker_email"):
            to_set.add(payload["booker_email"])
        subject = f"Booking Updated — ID {payload.get('booking_id')}"
        body = (
            f"Your booking (ID: {payload.get('booking_id')}) has been updated.\n"
            f"Room: {payload.get('room_id')}\n"
            f"From: {payload.get('start_at')}\n"
            f"To:   {payload.get('end_at')}\n"
        )
        self._send(list(to_set), subject, body)

    def send_booking_reminder(self, payload: dict) -> None:
        attendees = payload.get("attendees", [])
        to_set = {a["email"] for a in attendees if a.get("email")}
        if payload.get("booker_email"):
            to_set.add(payload["booker_email"])
        subject = f"Reminder: Meeting starts soon — Room {payload.get('room_id')}"
        body = (
            f"This is a reminder that your meeting (Booking ID: {payload.get('booking_id')})\n"
            f"starts at: {payload.get('start_at')}\n"
            f"Room: {payload.get('room_id')}\n"
        )
        self._send(list(to_set), subject, body)

    def send_room_maintenance(self, payload: dict) -> None:
        subject = f"Room {payload.get('room_name', payload.get('room_id'))} — Maintenance Started"
        body = (
            f"Room '{payload.get('room_name')}' (ID: {payload.get('room_id')}) "
            f"has been placed under maintenance.\n"
            f"New bookings for this room are blocked until it returns to Available.\n"
        )
        to = [payload["owner_email"]] if payload.get("owner_email") else []
        self._send(to, subject, body)
