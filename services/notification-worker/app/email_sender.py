"""EmailSender — gửi email thông báo booking lifecycle qua SMTP.

Thiết kế đơn giản, chuyên nghiệp, tập trung vào nội dung cuộc họp,
không màu mè, tối giản biểu tượng, tích hợp logo công ty.
"""

import logging
import smtplib
from datetime import datetime
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Danh sách thứ trong tuần tiếng Việt
WEEKDAYS = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"]

STATIC_DIR = Path(__file__).resolve().parent / "static"
ICON_PATH = STATIC_DIR / "mrms-icon.png"


def _format_datetime(iso_str: Any) -> str:
    """Format ISO datetime: HH:MM · Thứ X, DD/MM/YYYY."""
    if not iso_str:
        return "—"
    try:
        dt = datetime.fromisoformat(str(iso_str).replace("Z", "+00:00"))
        weekday = WEEKDAYS[dt.weekday()]
        dmy = dt.strftime("%d/%m/%Y")
        hm = dt.strftime("%H:%M")
        return f"{hm} · {weekday}, {dmy}"
    except Exception:
        return str(iso_str)


def _format_time_range(start_iso: Any, end_iso: Any) -> str:
    """Format khoảng thời gian cuộc họp rõ ràng, tập trung."""
    if not start_iso and not end_iso:
        return "—"
    if start_iso and not end_iso:
        return _format_datetime(start_iso)
    if end_iso and not start_iso:
        return _format_datetime(end_iso)
    try:
        dt_start = datetime.fromisoformat(str(start_iso).replace("Z", "+00:00"))
        dt_end = datetime.fromisoformat(str(end_iso).replace("Z", "+00:00"))
        start_hm = dt_start.strftime("%H:%M")
        end_hm = dt_end.strftime("%H:%M")
        start_dmy = dt_start.strftime("%d/%m/%Y")
        weekday = WEEKDAYS[dt_start.weekday()]
        if dt_start.date() == dt_end.date():
            return f"{start_hm} – {end_hm} · {weekday}, {start_dmy}"
        end_dmy = dt_end.strftime("%d/%m/%Y")
        end_weekday = WEEKDAYS[dt_end.weekday()]
        return f"{start_hm} ({weekday}, {start_dmy}) – {end_hm} ({end_weekday}, {end_dmy})"
    except Exception:
        return f"{start_iso} – {end_iso}"


def _format_attendees(attendees: list[dict]) -> str:
    """Format danh sách người tham gia."""
    if not attendees:
        return "—"
    items = []
    for a in attendees:
        email = a.get("email") or a.get("attendee_email") or ""
        name = a.get("name") or ""
        if name and email and name != email:
            items.append(f"{name} ({email})")
        elif email:
            items.append(email)
        elif name:
            items.append(name)
    return ", ".join(items) if items else "—"


def _row(label: str, value: str, is_last: bool = False) -> str:
    """Hàng hiển thị thông tin trong bảng chi tiết cuộc họp."""
    border_style = "" if is_last else "border-bottom:1px solid #f3f4f6;"
    td_label_style = (
        "padding:12px 16px;color:#6b7280;font-size:13px;font-weight:500;"
        f"width:140px;vertical-align:top;{border_style}"
    )
    td_val_style = (
        "padding:12px 16px;color:#111827;font-size:14px;font-weight:500;"
        f"vertical-align:top;{border_style}"
    )
    return f"""
    <tr>
      <td style="{td_label_style}">{label}</td>
      <td style="{td_val_style}">{value}</td>
    </tr>
    """


def _info_table(*rows: str) -> str:
    """Bảng hiển thị các thông số chi tiết của cuộc họp."""
    clean_rows = [r for r in rows if r]
    table_style = (
        "border:1px solid #e5e7eb;border-radius:6px;background:#ffffff;"
        "overflow:hidden;margin:20px 0 0 0;"
    )
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="{table_style}">
      {"".join(clean_rows)}
    </table>
    """


def _notice_box(text: str) -> str:
    """Khung ghi chú trung tính, đơn giản, không màu mè."""
    box_style = (
        "background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;"
        "padding:13px 16px;margin:24px 0 0 0;"
    )
    return f"""
    <div style="{box_style}">
      <p style="margin:0;font-size:13px;line-height:1.55;color:#374151;">
        {text}
      </p>
    </div>
    """


def _meeting_header(title: str, subtitle: str) -> str:
    """Tiêu đề tập trung vào nội dung cuộc họp."""
    title_style = (
        "margin:0 0 8px 0;font-size:20px;font-weight:700;color:#111827;"
        "line-height:1.4;letter-spacing:-0.2px;"
    )
    sub_style = "margin:0;font-size:14px;color:#4b5563;line-height:1.5;"
    return f"""
    <div style="margin-bottom:24px;">
      <h1 style="{title_style}">{title}</h1>
      <p style="{sub_style}">{subtitle}</p>
    </div>
    """


def _html_wrapper(
    content_html: str,
    header_label: str = "THÔNG BÁO",
    logo_src: str = "cid:company_logo",
) -> str:
    """Khung email đơn giản, chuyên nghiệp với logo công ty và thiết kế tập trung nội dung."""
    body_style = (
        "margin:0;padding:0;background-color:#f3f4f6;"
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
        "-webkit-font-smoothing:antialiased;line-height:1.5;"
    )
    outer_table_style = "background-color:#f3f4f6;padding:36px 12px;"
    card_table_style = (
        "max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;"
        "overflow:hidden;border:1px solid #e5e7eb;"
    )
    header_td_style = "background-color:#ffffff;padding:20px 32px;border-bottom:1px solid #e5e7eb;"
    brand_title_style = (
        "font-size:16px;font-weight:700;color:#111827;letter-spacing:-0.2px;vertical-align:middle;"
    )
    brand_sub_style = "font-size:13px;color:#6b7280;vertical-align:middle;"
    badge_style = (
        "font-size:12px;font-weight:600;color:#4b5563;letter-spacing:0.5px;"
        "text-transform:uppercase;"
    )
    footer_td_style = (
        "background-color:#fafafa;border-top:1px solid #e5e7eb;padding:18px 32px;text-align:center;"
    )

    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Meeting Room Notification</title>
</head>
<body style="{body_style}">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="{outer_table_style}">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="{card_table_style}">

          <!-- Header with Company Icon -->
          <tr>
            <td style="{header_td_style}">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="middle" style="padding-right:10px;">
                          <img src="{logo_src}" width="32" height="32" alt="MRMS"
                               style="display:block;border-radius:4px;border:0;">
                        </td>
                        <td valign="middle">
                          <span style="{brand_title_style}">MRMS</span>
                          <span style="color:#d1d5db;margin:0 8px;vertical-align:middle;">|</span>
                          <span style="{brand_sub_style}">Quản lý phòng họp</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" valign="middle">
                    <span style="{badge_style}">{header_label}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding:32px 32px 28px 32px;">
              {content_html}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="{footer_td_style}">
              <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;color:#4b5563;">
                Hệ thống Quản lý Phòng họp (MRMS)
              </p>
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">
                Email thông báo tự động. Vui lòng không trả lời trực tiếp email này.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


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
        self._logo_bytes: bytes | None = None
        if ICON_PATH.exists():
            try:
                self._logo_bytes = ICON_PATH.read_bytes()
            except Exception:
                logger.warning("Không thể đọc logo icon từ %s", ICON_PATH)

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

        # Đính kèm logo inline (CID) để hiển thị trong mọi client
        if self._logo_bytes and "cid:company_logo" in html_body:
            msg = MIMEMultipart("related")
            alt = MIMEMultipart("alternative")
            msg.attach(alt)
            alt.attach(MIMEText(html_body, "html", "utf-8"))

            img = MIMEImage(self._logo_bytes, _subtype="png")
            img.add_header("Content-ID", "<company_logo>")
            img.add_header("Content-Disposition", "inline", filename="mrms-icon.png")
            msg.attach(img)
        else:
            msg = MIMEMultipart("alternative")
            msg.attach(MIMEText(html_body, "html", "utf-8"))

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
        to_set = {a["email"] for a in attendees if a.get("email")}
        booker = payload.get("booker_email") or payload.get("user_email")
        if booker:
            to_set.add(booker)

        room = payload.get("room_name") or f"Phòng {payload.get('room_id')}"
        booking_id = payload.get("booking_id", "")
        subject = f"[MRMS] Đặt phòng thành công — {room}"

        purpose = payload.get("purpose")
        meeting_title = purpose if purpose else "Xác nhận đặt phòng thành công"
        time_text = _format_time_range(payload.get("start_at"), payload.get("end_at"))

        purpose_row = _row("Mục đích:", purpose) if purpose else ""
        booker_row = _row("Người đặt phòng:", booker) if booker else ""

        content = f"""
            {
            _meeting_header(
                title=meeting_title,
                subtitle="Yêu cầu đặt phòng họp của bạn đã được xác nhận thành công.",
            )
        }
            {
            _info_table(
                _row("Thời gian:", time_text),
                _row("Phòng họp:", room),
                purpose_row,
                booker_row,
                _row("Người tham gia:", _format_attendees(attendees)),
                _row("Mã đặt phòng:", f"#{booking_id}", is_last=True),
            )
        }
            {
            _notice_box(
                "<strong>Lưu ý:</strong> Vui lòng check-in trong vòng 15 phút kể từ giờ "
                "bắt đầu để giữ phòng. Đặt phòng sẽ tự động hủy nếu quá thời gian quy định."
            )
        }
        """
        self._send(
            list(to_set),
            subject,
            _html_wrapper(content, header_label="XÁC NHẬN ĐẶT PHÒNG"),
        )

    def send_booking_cancelled(self, payload: dict) -> None:
        recipient = payload.get("booker_email") or payload.get("user_email")
        to = [recipient] if recipient else []

        booking_id = payload.get("booking_id", "")
        room = payload.get("room_name") or f"Phòng {payload.get('room_id', '')}"
        subject = f"[MRMS] Đặt phòng đã bị hủy — #{booking_id}"

        content = f"""
            {
            _meeting_header(
                title="Đặt phòng đã bị hủy",
                subtitle="Lịch đặt phòng họp dưới đây đã được hủy trên hệ thống.",
            )
        }
            {
            _info_table(
                _row("Phòng họp:", room),
                _row("Mã đặt phòng:", f"#{booking_id}", is_last=True),
            )
        }
            {
            _notice_box(
                "Phòng họp đã được giải phóng và sẵn sàng cho các thành viên khác đăng ký sử dụng."
            )
        }
        """
        self._send(to, subject, _html_wrapper(content, header_label="HỦY ĐẶT PHÒNG"))

    def send_booking_checked_in(self, payload: dict) -> None:
        recipient = payload.get("booker_email") or payload.get("user_email")
        to = [recipient] if recipient else []

        booking_id = payload.get("booking_id", "")
        room = payload.get("room_name") or f"Phòng {payload.get('room_id', '')}"
        subject = f"[MRMS] Check-in thành công — #{booking_id}"
        checked_time = _format_datetime(payload.get("checked_in_at"))

        content = f"""
            {
            _meeting_header(
                title="Check-in thành công",
                subtitle="Bạn đã hoàn tất check-in. Phòng họp đã sẵn sàng cho cuộc họp của bạn.",
            )
        }
            {
            _info_table(
                _row("Phòng họp:", room),
                _row("Thời gian check-in:", checked_time),
                _row("Mã đặt phòng:", f"#{booking_id}", is_last=True),
            )
        }
            {
            _notice_box("Phòng họp đã sẵn sàng. Chúc bạn và đồng nghiệp có một buổi họp hiệu quả!")
        }
        """
        self._send(to, subject, _html_wrapper(content, header_label="CHECK-IN THÀNH CÔNG"))

    def send_booking_auto_cancelled(self, payload: dict) -> None:
        recipient = payload.get("booker_email") or payload.get("user_email")
        to = [recipient] if recipient else []

        booking_id = payload.get("booking_id", "")
        room = payload.get("room_name") or f"Phòng {payload.get('room_id', '')}"
        subject = f"[MRMS] Đặt phòng bị hủy tự động — #{booking_id}"
        cancelled_time = _format_datetime(payload.get("auto_cancelled_at"))

        content = f"""
            {
            _meeting_header(
                title="Đặt phòng bị hủy do quá hạn check-in",
                subtitle="Hệ thống đã tự động hủy đặt phòng theo quy định.",
            )
        }
            {
            _info_table(
                _row("Phòng họp:", room),
                _row("Thời điểm hủy:", cancelled_time),
                _row("Mã đặt phòng:", f"#{booking_id}", is_last=True),
            )
        }
            {
            _notice_box(
                "Không có lượt check-in nào được ghi nhận trong vòng 15 phút sau giờ bắt đầu. "
                "Phòng đã được tự động hoàn trả lại hệ thống."
            )
        }
        """
        self._send(to, subject, _html_wrapper(content, header_label="TỰ ĐỘNG HỦY"))

    def send_booking_updated(self, payload: dict) -> None:
        attendees = payload.get("attendees", [])
        to_set = {
            a.get("email") or a.get("attendee_email")
            for a in attendees
            if (a.get("email") or a.get("attendee_email"))
        }
        booker = payload.get("booker_email") or payload.get("user_email")
        if booker:
            to_set.add(booker)

        booking_id = payload.get("booking_id", "")
        room = payload.get("room_name") or f"Phòng {payload.get('room_id', '')}"
        subject = f"[MRMS] Cập nhật đặt phòng — #{booking_id}"

        purpose = payload.get("purpose")
        meeting_title = purpose if purpose else "Cập nhật thông tin cuộc họp"
        time_text = _format_time_range(payload.get("start_at"), payload.get("end_at"))

        purpose_row = _row("Mục đích:", purpose) if purpose else ""
        attendee_row = _row("Người tham gia:", _format_attendees(attendees)) if attendees else ""

        content = f"""
            {
            _meeting_header(
                title=meeting_title,
                subtitle="Thông tin lịch họp của bạn đã được cập nhật lại trên hệ thống.",
            )
        }
            {
            _info_table(
                _row("Thời gian mới:", time_text),
                _row("Phòng họp:", room),
                purpose_row,
                attendee_row,
                _row("Mã đặt phòng:", f"#{booking_id}", is_last=True),
            )
        }
            {
            _notice_box(
                "Vui lòng kiểm tra lại thời gian và địa điểm mới để tham dự cuộc họp đúng giờ."
            )
        }
        """
        self._send(
            list(to_set),
            subject,
            _html_wrapper(content, header_label="CẬP NHẬT ĐẶT PHÒNG"),
        )

    def send_booking_reminder(self, payload: dict) -> None:
        """Check-in alert — gửi trước 15 phút khi cuộc họp bắt đầu."""
        attendees = payload.get("attendees", [])
        to_set = {
            a.get("email") or a.get("attendee_email")
            for a in attendees
            if (a.get("email") or a.get("attendee_email"))
        }
        booker = payload.get("booker_email") or payload.get("user_email")
        if booker:
            to_set.add(booker)

        booking_id = payload.get("booking_id", "")
        room = payload.get("room_name") or f"Phòng {payload.get('room_id', '')}"
        subject = "[MRMS] Nhắc nhở — Cuộc họp bắt đầu sau 15 phút"

        purpose = payload.get("purpose")
        meeting_title = purpose if purpose else "Cuộc họp bắt đầu sau 15 phút"
        start_time = _format_datetime(payload.get("start_at"))
        purpose_row = _row("Mục đích:", purpose) if purpose else ""

        content = f"""
            {
            _meeting_header(
                title=meeting_title,
                subtitle="Cuộc họp của bạn sẽ bắt đầu trong khoảng 15 phút tới.",
            )
        }
            {
            _info_table(
                _row("Thời gian bắt đầu:", start_time),
                _row("Phòng họp:", room),
                purpose_row,
                _row("Mã đặt phòng:", f"#{booking_id}", is_last=True),
            )
        }
            {
            _notice_box(
                "<strong>Nhắc nhở:</strong> Vui lòng check-in trong vòng 15 phút kể từ "
                "giờ bắt đầu. Đặt phòng sẽ bị hủy tự động nếu không có lượt check-in đúng giờ."
            )
        }
        """
        self._send(
            list(to_set),
            subject,
            _html_wrapper(content, header_label="NHẮC NHỞ 15 PHÚT"),
        )

    def send_booking_daily_reminder(self, payload: dict) -> None:
        """Nhắc lịch trước 1 ngày."""
        attendees = payload.get("attendees", [])
        to_set = {
            a.get("email") or a.get("attendee_email")
            for a in attendees
            if (a.get("email") or a.get("attendee_email"))
        }
        booker = payload.get("booker_email") or payload.get("user_email")
        if booker:
            to_set.add(booker)

        booking_id = payload.get("booking_id", "")
        room = payload.get("room_name") or f"Phòng {payload.get('room_id', '')}"
        subject = f"[MRMS] Nhắc lịch họp ngày mai — {room}"

        purpose = payload.get("purpose")
        meeting_title = purpose if purpose else "Bạn có cuộc họp vào ngày mai"
        time_text = _format_time_range(payload.get("start_at"), payload.get("end_at"))
        purpose_row = _row("Mục đích:", purpose) if purpose else ""

        content = f"""
            {
            _meeting_header(
                title=meeting_title,
                subtitle="Thông báo nhắc lịch họp được lên kế hoạch cho ngày mai.",
            )
        }
            {
            _info_table(
                _row("Thời gian:", time_text),
                _row("Phòng họp:", room),
                purpose_row,
                _row("Người tham gia:", _format_attendees(attendees)),
                _row("Mã đặt phòng:", f"#{booking_id}", is_last=True),
            )
        }
            {
            _notice_box(
                "Vui lòng chuẩn bị trước tài liệu cuộc họp và check-in trong vòng 15 phút đầu giờ."
            )
        }
        """
        self._send(
            list(to_set),
            subject,
            _html_wrapper(content, header_label="LỊCH HỌP NGÀY MAI"),
        )

    def send_booking_invitation(self, payload: dict) -> None:
        """Email mời tham dự cho attendees."""
        attendees = payload.get("attendees", [])
        to_list = [
            a.get("email") or a.get("attendee_email")
            for a in attendees
            if (a.get("email") or a.get("attendee_email"))
        ]
        if not to_list:
            return

        booking_id = payload.get("booking_id", "")
        room = payload.get("room_name") or f"Phòng {payload.get('room_id', '')}"
        booker_name = payload.get("booker_name") or "Người tổ chức"
        subject = f"[MRMS] Mời dự họp — {room}"
        time_text = _format_time_range(payload.get("start_at"), payload.get("end_at"))
        purpose_row = _row("Mục đích:", payload["purpose"]) if payload.get("purpose") else ""

        content = f"""
            {
            _meeting_header(
                title="Bạn được mời tham dự cuộc họp",
                subtitle=f"{booker_name} mời bạn tham gia cuộc họp.",
            )
        }
            {
            _info_table(
                _row("Mã đặt phòng:", f"#{booking_id}"),
                _row("Phòng họp:", room),
                _row("Thời gian:", time_text),
                purpose_row if purpose_row else "",
                _row("Người tổ chức:", booker_name, is_last=True),
            )
        }
            {
            _notice_box(
                "Vui lòng kiểm tra lịch của bạn và chuẩn bị tài liệu cần thiết cho cuộc họp."
            )
        }
        """
        self._send(to_list, subject, _html_wrapper(content, header_label="LỜI MỜI"))

    def send_room_maintenance(self, payload: dict) -> None:
        recipient = (
            payload.get("owner_email") or payload.get("booker_email") or payload.get("user_email")
        )
        to = [recipient] if recipient else []

        room = payload.get("room_name") or f"Phòng {payload.get('room_id', '')}"
        subject = f"[MRMS] {room} — Thông báo bảo trì"

        content = f"""
            {
            _meeting_header(
                title=f"Bảo trì {room}",
                subtitle="Thông báo cập nhật trạng thái hoạt động của cơ sở vật chất.",
            )
        }
            {
            _info_table(
                _row("Phòng họp:", room),
                _row("Trạng thái:", "Đang bảo trì (MAINTENANCE)"),
                _row("Thời điểm:", _format_datetime(datetime.now()), is_last=True),
            )
        }
            {
            _notice_box(
                "Các yêu cầu đặt phòng mới cho phòng này tạm thời bị khóa cho đến khi "
                "hoàn tất bảo trì kỹ thuật và chuyển về trạng thái sẵn sàng (Available)."
            )
        }
        """
        self._send(to, subject, _html_wrapper(content, header_label="BẢO TRÌ PHÒNG"))
