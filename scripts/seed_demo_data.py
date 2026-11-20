#!/usr/bin/env python3
"""
Seed demo data: ~80 bookings (30 ngày qua) + ~40 audit logs.
Chạy bên trong booking-service container:
  docker compose cp scripts/seed_demo_data.py booking-service:/tmp/seed.py
  docker compose exec booking-service python3 /tmp/seed.py
"""
import os
import random
import sys
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://booking_user:booking_pass@postgres:5432/booking_db",
)

ROOMS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

USERS = [
    ("auth0|6afa66fa41a65eaaedf942f0", "Nguyễn Văn Hùng",   "hungnv@blueocsolutions.com",  "EMPLOYEE"),
    ("auth0|user_alice_001",           "Trần Thị Alice",     "alice@blueocsolutions.com",   "EMPLOYEE"),
    ("auth0|user_bob_002",             "Lê Văn Bob",         "bob@blueocsolutions.com",     "EMPLOYEE"),
    ("auth0|user_carol_003",           "Phạm Thị Carol",     "carol@blueocsolutions.com",   "EMPLOYEE"),
    ("auth0|user_dave_004",            "Hoàng Minh Đức",     "duc@blueocsolutions.com",     "EMPLOYEE"),
    ("auth0|user_eve_005",             "Ngô Thị Eve",        "eve@blueocsolutions.com",     "ROOM_MANAGER"),
    ("auth0|admin_frank_006",          "Đinh Quốc Frank",    "frank@blueocsolutions.com",   "ADMINISTRATOR"),
]

PURPOSES = [
    "Họp dự án Q4", "Sprint planning", "Sprint retrospective", "Review tiến độ",
    "Phỏng vấn ứng viên", "Đào tạo nội bộ", "Họp ban lãnh đạo",
    "Demo sản phẩm", "Workshop UX/UI", "Họp khách hàng", "1-on-1 với PM",
    "Kickoff dự án mới", "Họp hội đồng kỹ thuật", "Training backend",
]

TITLES = [
    "Sprint Review W46", "Phỏng vấn Senior Dev", "Demo Q4 2026",
    "Kickoff BlueOC MRMS", "Workshop Figma", None, None, None,
]

ROOM_NAMES = {
    9: "P101 - Phòng họp nhỏ A", 10: "P102 - Phòng họp nhỏ B",
    11: "P201 - Phòng họp vừa A", 12: "P202 - Phòng họp vừa B",
    13: "P301 - Phòng họp lớn", 14: "P302 - Phòng đào tạo",
    15: "P401 - Boardroom", 16: "P402 - Phòng phỏng vấn",
    17: "P501 - Hội trường", 18: "P103 - Phòng brainstorm",
}

# (start_hour, duration_minutes)
TIME_SLOTS = [
    (8, 60), (8, 90), (9, 60), (9, 90), (10, 60), (10, 90), (11, 60),
    (13, 60), (13, 90), (14, 60), (14, 90), (15, 60), (15, 90), (16, 60),
]

AUDIT_ACTIONS = [
    ("BOOKING_CREATED",          "Tạo booking phòng {room}"),
    ("BOOKING_CANCELLED",        "Hủy booking phòng {room} do thay đổi lịch họp"),
    ("BOOKING_CHECKED_IN",       "Check-in thành công phòng {room}"),
    ("ROOM_UPDATED",             "Cập nhật thông tin phòng {room}"),
    ("USER_ROLE_CHANGED",        "Thay đổi vai trò người dùng lên ROOM_MANAGER"),
    ("POLICY_CONFIG_UPDATED",    "Cập nhật cấu hình: max_advance_days = 14"),
    ("ROOM_FORCE_RELEASED",      "Force release phòng {room} — booking quá hạn check-in"),
    ("ROOM_MAINTENANCE_TOGGLED", "Đặt phòng {room} vào chế độ bảo trì định kỳ"),
    ("USER_CREATED",             "Tạo tài khoản nhân viên mới"),
    ("BOOKING_FORCE_CANCELLED",  "Hủy bắt buộc booking phòng {room} do vi phạm quy định"),
]

IP_POOL = ["10.0.4.12", "10.0.4.15", "10.0.4.23", "192.168.1.101", "192.168.1.45"]


def seed(engine):
    today = date.today()
    inserted_b = 0
    inserted_l = 0

    # Track non-cancellable occupied slots per room to respect EXCLUDE constraint
    occupied: dict[int, list[tuple[datetime, datetime]]] = {r: [] for r in ROOMS}

    def overlaps(room_id, s, e):
        for os_, oe in occupied[room_id]:
            if s < oe and e > os_:
                return True
        return False

    with engine.begin() as conn:
        # ── Bookings ──────────────────────────────────────────────────────────
        for days_ago in range(1, 31):
            day = today - timedelta(days=days_ago)
            if day.weekday() >= 5:   # skip weekend
                continue

            n_bookings = random.randint(3, 5)
            rooms_shuffled = ROOMS[:]
            random.shuffle(rooms_shuffled)
            slots_shuffled = TIME_SLOTS[:]
            random.shuffle(slots_shuffled)

            placed = 0
            for room_id in rooms_shuffled:
                if placed >= n_bookings:
                    break
                for start_h, dur in slots_shuffled:
                    tz = timezone.utc
                    start = datetime(day.year, day.month, day.day, start_h, 0, tzinfo=tz)
                    end = start + timedelta(minutes=dur)

                    if overlaps(room_id, start, end):
                        continue

                    if days_ago <= 2:
                        status = random.choices(
                            ["CONFIRMED", "CHECKED_IN", "CANCELLED"],
                            weights=[40, 40, 20],
                        )[0]
                    else:
                        status = random.choices(
                            ["CHECKED_IN", "CANCELLED"],
                            weights=[70, 30],
                        )[0]

                    user = random.choice(USERS)
                    checked_in_at = None
                    auto_cancelled_at = None
                    if status == "CHECKED_IN":
                        checked_in_at = start + timedelta(minutes=random.randint(0, 12))
                    elif status == "CANCELLED" and random.random() < 0.35:
                        auto_cancelled_at = start + timedelta(minutes=15)

                    conn.execute(text("""
                        INSERT INTO bookings
                          (room_id, user_id, start_at, end_at, num_attendees, status,
                           checked_in_at, auto_cancelled_at, booker_email, purpose, title,
                           created_at, updated_at)
                        VALUES
                          (:room_id, :user_id, :start_at, :end_at, :num_att, :status,
                           :checked_in_at, :auto_cancelled_at, :email, :purpose, :title,
                           :created_at, :updated_at)
                    """), {
                        "room_id": room_id,
                        "user_id": user[0],
                        "start_at": start,
                        "end_at": end,
                        "num_att": random.randint(1, 6),
                        "status": status,
                        "checked_in_at": checked_in_at,
                        "auto_cancelled_at": auto_cancelled_at,
                        "email": user[2],
                        "purpose": random.choice(PURPOSES),
                        "title": random.choice(TITLES),
                        "created_at": start - timedelta(hours=random.randint(1, 48)),
                        "updated_at": start - timedelta(minutes=5),
                    })

                    if status in ("CONFIRMED", "CHECKED_IN"):
                        occupied[room_id].append((start, end))

                    inserted_b += 1
                    placed += 1
                    break

        print(f"✅ Inserted {inserted_b} bookings")

        # ── Audit logs ────────────────────────────────────────────────────────
        for days_ago in range(1, 31):
            day = today - timedelta(days=days_ago)
            if day.weekday() >= 5:
                continue

            for _ in range(random.randint(1, 3)):
                user = random.choice(USERS)
                action, detail_tpl = random.choice(AUDIT_ACTIONS)
                room_id = random.choice(ROOMS)
                detail = detail_tpl.format(room=ROOM_NAMES.get(room_id, f"#{room_id}"))
                ts = datetime(
                    day.year, day.month, day.day,
                    random.randint(8, 18), random.randint(0, 59),
                    tzinfo=timezone.utc,
                )
                conn.execute(text("""
                    INSERT INTO audit_logs
                      (timestamp, actor_id, actor_name, actor_role, action_type,
                       target_id, target_name, details, ip_address)
                    VALUES
                      (:ts, :actor_id, :actor_name, :actor_role, :action_type,
                       :target_id, :target_name, :details, :ip)
                """), {
                    "ts": ts,
                    "actor_id": user[0],
                    "actor_name": user[1],
                    "actor_role": user[3],
                    "action_type": action,
                    "target_id": str(room_id),
                    "target_name": ROOM_NAMES.get(room_id),
                    "details": detail,
                    "ip": random.choice(IP_POOL),
                })
                inserted_l += 1

        print(f"✅ Inserted {inserted_l} audit logs")

    print("🎉 Seed hoàn thành!")


def main():
    try:
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        seed(engine)
    except Exception as e:
        print(f"❌ Lỗi: {e}", file=sys.stderr)
        import traceback; traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
