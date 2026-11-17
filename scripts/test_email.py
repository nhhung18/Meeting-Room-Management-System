#!/usr/bin/env python3
"""Script test gửi email thông báo từ notification-worker.

Cách dùng:
  1. Gửi email thật qua SMTP (lấy cấu hình từ .env):
       python scripts/test_email.py --to your_email@example.com --type created
       python scripts/test_email.py --to your_email@example.com --type all

  2. Xuất file HTML để xem trước giao diện trên trình duyệt (không cần gửi email):
       python scripts/test_email.py --preview
"""

import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

# Thêm path tới notification-worker app
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "services" / "notification-worker"))

from app.email_sender import EmailSender  # noqa: E402


def load_env_file(env_path: Path) -> dict[str, str]:
    """Đọc file .env đơn giản không phụ thuộc thư viện ngoài."""
    env = {}
    if not env_path.exists():
        return env
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                env[key.strip()] = val.strip().strip("'\"")
    return env


def get_sample_payloads(to_email: str) -> dict[str, dict]:
    """Tạo dữ liệu mẫu phong phú để test các kịch bản."""
    now = datetime.now(timezone.utc)
    start_time = now + timedelta(hours=2)
    end_time = start_time + timedelta(hours=1, minutes=30)
    tomorrow_start = now + timedelta(days=1, hours=2)
    tomorrow_end = tomorrow_start + timedelta(hours=2)

    return {
        "created": {
            "booking_id": 1042,
            "room_id": 5,
            "room_name": "Phòng Hội Thảo A (Tầng 3)",
            "start_at": start_time.isoformat(),
            "end_at": end_time.isoformat(),
            "purpose": "Họp kế hoạch Sprint 14 & phân công công việc quý 4",
            "booker_email": to_email,
            "attendees": [
                {"name": "Nguyễn Văn Hùng", "email": to_email},
                {"name": "Trần Thị Mai", "email": "mai.tran@example.com"},
                {"name": "Lê Văn Tuấn", "email": "tuan.le@example.com"},
            ],
        },
        "checked_in": {
            "booking_id": 1042,
            "room_id": 5,
            "room_name": "Phòng Hội Thảo A (Tầng 3)",
            "checked_in_at": now.isoformat(),
            "booker_email": to_email,
        },
        "reminder": {
            "booking_id": 1042,
            "room_id": 5,
            "room_name": "Phòng Hội Thảo A (Tầng 3)",
            "start_at": (now + timedelta(minutes=15)).isoformat(),
            "end_at": (now + timedelta(hours=1, minutes=15)).isoformat(),
            "booker_email": to_email,
            "attendees": [{"name": "Nguyễn Văn Hùng", "email": to_email}],
        },
        "daily_reminder": {
            "booking_id": 1045,
            "room_id": 3,
            "room_name": "Phòng Họp Ban Giám Đốc (Tầng 5)",
            "start_at": tomorrow_start.isoformat(),
            "end_at": tomorrow_end.isoformat(),
            "purpose": "Họp chiến lược phát triển sản phẩm năm 2027",
            "booker_email": to_email,
            "attendees": [{"name": "Nguyễn Văn Hùng", "email": to_email}],
        },
        "updated": {
            "booking_id": 1042,
            "room_id": 8,
            "room_name": "Phòng Sáng Tạo Creative Lab (Tầng 2)",
            "start_at": (start_time + timedelta(hours=1)).isoformat(),
            "end_at": (end_time + timedelta(hours=1)).isoformat(),
            "purpose": "Họp kế hoạch Sprint 14 (đã đổi sang phòng rộng hơn)",
            "booker_email": to_email,
            "attendees": [{"name": "Nguyễn Văn Hùng", "email": to_email}],
        },
        "cancelled": {
            "booking_id": 1042,
            "room_id": 5,
            "room_name": "Phòng Hội Thảo A (Tầng 3)",
            "booker_email": to_email,
        },
        "auto_cancelled": {
            "booking_id": 1043,
            "room_id": 2,
            "room_name": "Phòng Họp Nhỏ B02",
            "auto_cancelled_at": now.isoformat(),
            "booker_email": to_email,
        },
        "maintenance": {
            "room_id": 5,
            "room_name": "Phòng Hội Thảo A (Tầng 3)",
            "owner_email": to_email,
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Test gửi email thông báo MRMS")
    parser.add_argument(
        "--to",
        help="Email người nhận (mặc định lấy từ SMTP_USER / SMTP_FROM_EMAIL trong .env)",
    )
    parser.add_argument(
        "--type",
        choices=[
            "created",
            "checked_in",
            "reminder",
            "daily_reminder",
            "updated",
            "cancelled",
            "auto_cancelled",
            "maintenance",
            "all",
        ],
        default="created",
        help="Loại email muốn test (mặc định: created)",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Xuất file HTML ra thư mục preview để mở xem trên trình duyệt mà không gửi SMTP",
    )
    args = parser.parse_args()

    # Đọc cấu hình từ .env
    env = load_env_file(REPO_ROOT / ".env")
    smtp_host = env.get("SMTP_HOST", "")
    smtp_port = int(env.get("SMTP_PORT", "587"))
    smtp_user = env.get("SMTP_USER", "")
    smtp_password = env.get("SMTP_PASSWORD", "")
    smtp_from = env.get("SMTP_FROM_EMAIL", smtp_user or "noreply@mrms.local")

    target_email = args.to or smtp_user or "test@example.com"
    payloads = get_sample_payloads(target_email)

    # Chế độ PREVIEW HTML
    if args.preview:
        preview_dir = REPO_ROOT / "preview_emails"
        preview_dir.mkdir(exist_ok=True)
        print(f"📂 Đang tạo preview HTML tại thư mục: {preview_dir}")

        captured = []
        sender = EmailSender("", 587, "", "", smtp_from)
        sender._send = lambda to, subj, html: captured.append((subj, html))

        types_to_run = (
            list(payloads.keys()) if args.type == "all" else [args.type]
        )
        for t in types_to_run:
            getattr(sender, f"send_booking_{t}" if t != "maintenance" else "send_room_maintenance")(payloads[t])

        icon_path = REPO_ROOT / "services" / "notification-worker" / "app" / "static" / "mrms-icon.png"
        b64_icon = ""
        if icon_path.exists():
            import base64
            b64_icon = base64.b64encode(icon_path.read_bytes()).decode("ascii")

        for (subj, html), t in zip(captured, types_to_run):
            if b64_icon:
                html = html.replace("cid:company_logo", f"data:image/png;base64,{b64_icon}")
            file_path = preview_dir / f"{t}.html"
            file_path.write_text(html, encoding="utf-8")
            print(f"  ✓ [{t}] Đã lưu: {file_path}")

        index_file = preview_dir / "index.html"
        links = "".join(
            f'<li style="margin: 10px 0;"><a style="font-size: 16px; color: #2563eb; text-decoration: none;" href="{t}.html" target="viewer"><strong>{t}</strong> — {p.get("room_name", "")}</a></li>'
            for t, p in payloads.items()
        )
        index_html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"><title>MRMS Email Templates Preview</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; display: flex; height: 100vh; }}
    #sidebar {{ width: 280px; background: #0f172a; color: #fff; padding: 24px; box-sizing: border-box; }}
    #content {{ flex: 1; border: none; }}
  </style>
</head>
<body>
  <div id="sidebar">
    <h2 style="margin-top:0; font-size: 18px; color: #38bdf8;">MRMS Email Preview</h2>
    <p style="font-size: 12px; color: #94a3b8;">Chọn mẫu email để xem:</p>
    <ul style="padding-left: 16px;">{links}</ul>
  </div>
  <iframe name="viewer" id="content" src="{types_to_run[0]}.html"></iframe>
</body>
</html>"""
        index_file.write_text(index_html, encoding="utf-8")
        print("\n✨ Xong! Mở file sau trên trình duyệt để duyệt toàn bộ mẫu email:")
        print(f"👉 file://{index_file}")
        return

    # Chế độ GỬI EMAIL THẬT QUA SMTP
    print("=" * 60)
    print("🚀 MRMS EMAIL TESTING")
    print("=" * 60)
    print(f"• SMTP Server : {smtp_host or '(Trống -> Dev Mode)'}:{smtp_port}")
    print(f"• From        : {smtp_from}")
    print(f"• User        : {smtp_user}")
    print(f"• Gửi đến     : {target_email}")
    print(f"• Loại email  : {args.type}")
    print("=" * 60)

    if not smtp_host:
        print("⚠️ CẢNH BÁO: Biến SMTP_HOST trong .env đang để trống!")
        print("   Email sẽ chỉ in ra log (dev mode) chứ không gửi đi thật.")
        print("   Nếu muốn gửi thật, hãy điền thông tin SMTP vào file .env.")
        print("-" * 60)

    sender = EmailSender(
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        smtp_user=smtp_user,
        smtp_password=smtp_password,
        from_email=smtp_from,
    )

    types_to_run = list(payloads.keys()) if args.type == "all" else [args.type]

    for t in types_to_run:
        print(f"\n📨 Đang xử lý email [{t}]...")
        payload = payloads[t]
        method_name = f"send_booking_{t}" if t != "maintenance" else "send_room_maintenance"
        method = getattr(sender, method_name)
        try:
            method(payload)
            print(f"  ✓ Gửi thành công email [{t}] tới {target_email}")
        except Exception as e:
            print(f"  ✗ Lỗi khi gửi [{t}]: {e}")

    print("\n" + "=" * 60)
    print("Hoàn tất quá trình test email!")
    print("=" * 60)


if __name__ == "__main__":
    main()
