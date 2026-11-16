"""EmailSender — gửi email thông báo booking lifecycle qua SMTP.

Dev mode: khi smtp_host rỗng, log nội dung email thay vì gửi thật.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def _html_wrapper(content_html: str) -> str:
    """Wrap content in a branded HTML email template."""
    return f"""<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1677ff;padding:20px 32px;">
            <span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:1px;">MRMS</span>
            <span style="font-size:13px;color:#d6e8ff;margin-left:10px;">Meeting Room Management System</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            {content_html}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#fafafa;border-top:1px solid #f0f0f0;padding:16px 32px;text-align:center;">
            <span style="font-size:12px;color:#8c8c8c;">Meeting Room Management System &copy; 2026</span>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _row(label: str, value: str) -> str:
    return (
        f'<tr>'
        f'<td style="padding:6px 0;color:#8c8c8c;font-size:14px;width:120px;">{label}</td>'
        f'<td style="padding:6px 0;color:#262626;font-size:14px;"><strong>{value}</strong></td>'
        f'</tr>'
    )


def _info_table(*rows: str) -> str:
    return (
        '<table cellpadding="0" cellspacing="0" '
        'style="background:#f7f9fc;border-radius:6px;padding:16px 20px;'
        'margin:16px 0;width:100%;border:1px solid #e8ecf0;">'
        + "".join(rows)
        + "</table>"
    )


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

    def _send(self, to_emails: list[str], subject: str, html_body: str) -> None:
        if not to_emails:
            logger.warning(
                "no recipients, email skipped",
                extra={"fields": {"subject": subject}},
            )
            return
        if not self._host:
            logger.info(
                "dev mode: email not sent",
                extra={"fields": {"to": to_emails, "subject": subject}},
            )
            return
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self._from
        msg["To"] = ", ".join(to_emails)
        msg.attach(MIMEText(html_body, "html", "utf-8"))
        with smtplib.SMTP(self._host, self._port) as conn:
            conn.starttls()
            if self._user:
                conn.login(self._user, self._password)
            conn.sendmail(self._from, to_emails, msg.as_string())

    def send_booking_created(self, payload: dict) -> None:
        attendees = payload.get("attendees", [])
        to_set = {a["email"] for a in attendees if a.get("email")}
        if payload.get("booker_email"):
            to_set.add(payload["booker_email"])
        room = payload.get("room_name") or f"Room {payload.get('room_id')}"
        subject = f"[MRMS] Đặt phòng thành công — {room}"
        purpose_row = _row("Mục đích:", payload["purpose"]) if payload.get("purpose") else ""
        attendee_emails = ", ".join(a["email"] for a in attendees if a.get("email")) or "—"
        content = f"""
            <h2 style="color:#262626;margin-top:0;">Đặt phòng thành công ✓</h2>
            <p style="color:#595959;font-size:15px;">Phòng họp của bạn đã được xác nhận.</p>
            {_info_table(
                _row("Mã đặt phòng:", str(payload.get("booking_id", ""))),
                _row("Phòng:", room),
                _row("Bắt đầu:", payload.get("start_at", "")),
                _row("Kết thúc:", payload.get("end_at", "")),
                purpose_row,
                _row("Người tham dự:", attendee_emails),
            )}
            <p style="color:#595959;font-size:14px;margin-top:16px;">
              ⚠️ Vui lòng <strong>check-in trong vòng 15 phút</strong> kể từ giờ bắt đầu
              để tránh bị hủy tự động.
            </p>
        """
        self._send(list(to_set), subject, _html_wrapper(content))

    def send_booking_cancelled(self, payload: dict) -> None:
        to = [payload["booker_email"]] if payload.get("booker_email") else []
        subject = f"[MRMS] Đặt phòng đã bị hủy — ID {payload.get('booking_id')}"
        content = f"""
            <h2 style="color:#ff4d4f;margin-top:0;">Đặt phòng đã bị hủy</h2>
            {_info_table(
                _row("Mã đặt phòng:", str(payload.get("booking_id", ""))),
                _row("Phòng:", f"Room {payload.get('room_id', '')}"),
            )}
        """
        self._send(to, subject, _html_wrapper(content))

    def send_booking_checked_in(self, payload: dict) -> None:
        to = [payload["booker_email"]] if payload.get("booker_email") else []
        subject = f"[MRMS] Check-in thành công — ID {payload.get('booking_id')}"
        content = f"""
            <h2 style="color:#52c41a;margin-top:0;">Check-in thành công ✓</h2>
            {_info_table(
                _row("Mã đặt phòng:", str(payload.get("booking_id", ""))),
                _row("Check-in lúc:", payload.get("checked_in_at", "")),
            )}
        """
        self._send(to, subject, _html_wrapper(content))

    def send_booking_auto_cancelled(self, payload: dict) -> None:
        to = [payload["booker_email"]] if payload.get("booker_email") else []
        subject = f"[MRMS] Đặt phòng bị hủy tự động — ID {payload.get('booking_id')}"
        content = f"""
            <h2 style="color:#ff4d4f;margin-top:0;">Đặt phòng bị hủy tự động</h2>
            <p style="color:#595959;font-size:15px;">
              Không có check-in trong 15 phút sau giờ bắt đầu.
            </p>
            {_info_table(
                _row("Mã đặt phòng:", str(payload.get("booking_id", ""))),
                _row("Hủy lúc:", payload.get("auto_cancelled_at", "")),
            )}
        """
        self._send(to, subject, _html_wrapper(content))

    def send_booking_updated(self, payload: dict) -> None:
        attendees = payload.get("attendees", [])
        to_set = {a["email"] for a in attendees if a.get("email")}
        if payload.get("booker_email"):
            to_set.add(payload["booker_email"])
        subject = f"[MRMS] Cập nhật đặt phòng — ID {payload.get('booking_id')}"
        content = f"""
            <h2 style="color:#1677ff;margin-top:0;">Đặt phòng đã được cập nhật</h2>
            {_info_table(
                _row("Mã đặt phòng:", str(payload.get("booking_id", ""))),
                _row("Phòng:", f"Room {payload.get('room_id', '')}"),
                _row("Bắt đầu:", payload.get("start_at", "")),
                _row("Kết thúc:", payload.get("end_at", "")),
            )}
        """
        self._send(list(to_set), subject, _html_wrapper(content))

    def send_booking_reminder(self, payload: dict) -> None:
        """Check-in alert — gửi trước 15 phút khi cuộc họp bắt đầu."""
        attendees = payload.get("attendees", [])
        to_set = {a["email"] for a in attendees if a.get("email")}
        if payload.get("booker_email"):
            to_set.add(payload["booker_email"])
        room = payload.get("room_name") or f"Room {payload.get('room_id')}"
        subject = f"[MRMS] Nhắc nhở — Cuộc họp bắt đầu sau 15 phút"
        content = f"""
            <h2 style="color:#faad14;margin-top:0;">⏰ Cuộc họp sắp bắt đầu</h2>
            <p style="color:#595959;font-size:15px;">Cuộc họp của bạn bắt đầu sau khoảng 15 phút.</p>
            {_info_table(
                _row("Mã đặt phòng:", str(payload.get("booking_id", ""))),
                _row("Phòng:", room),
                _row("Bắt đầu:", payload.get("start_at", "")),
            )}
            <p style="color:#595959;font-size:14px;margin-top:16px;">
              ⚠️ Hãy <strong>check-in đúng giờ</strong>. Đặt phòng sẽ bị hủy tự động
              nếu không check-in trong 15 phút sau giờ bắt đầu.
            </p>
        """
        self._send(list(to_set), subject, _html_wrapper(content))

    def send_booking_daily_reminder(self, payload: dict) -> None:
        """Nhắc lịch trước 1 ngày."""
        attendees = payload.get("attendees", [])
        to_set = {a["email"] for a in attendees if a.get("email")}
        if payload.get("booker_email"):
            to_set.add(payload["booker_email"])
        room = payload.get("room_name") or f"Room {payload.get('room_id')}"
        subject = f"[MRMS] Nhắc lịch họp ngày mai — {room}"
        purpose_row = _row("Mục đích:", payload["purpose"]) if payload.get("purpose") else ""
        content = f"""
            <h2 style="color:#1677ff;margin-top:0;">📅 Bạn có cuộc họp vào ngày mai</h2>
            {_info_table(
                _row("Mã đặt phòng:", str(payload.get("booking_id", ""))),
                _row("Phòng:", room),
                _row("Bắt đầu:", payload.get("start_at", "")),
                _row("Kết thúc:", payload.get("end_at", "")),
                purpose_row,
            )}
            <p style="color:#595959;font-size:14px;margin-top:16px;">
              Nhớ check-in trong vòng 15 phút kể từ giờ bắt đầu.
            </p>
        """
        self._send(list(to_set), subject, _html_wrapper(content))

    def send_room_maintenance(self, payload: dict) -> None:
        to = [payload["owner_email"]] if payload.get("owner_email") else []
        subject = f"[MRMS] Phòng {payload.get('room_name', payload.get('room_id'))} — Bảo trì"
        content = f"""
            <h2 style="color:#faad14;margin-top:0;">🔧 Phòng đang bảo trì</h2>
            {_info_table(
                _row("Phòng:", payload.get("room_name", f"Room {payload.get('room_id')}")),
                _row("Trạng thái:", "MAINTENANCE"),
            )}
            <p style="color:#595959;font-size:14px;">
              Các đặt phòng mới cho phòng này bị tạm khóa cho đến khi trở về trạng thái Available.
            </p>
        """
        self._send(to, subject, _html_wrapper(content))
