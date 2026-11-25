"""Integration tests cho /reports/stats (FR-07) — aggregate bằng SQL trên Postgres thật.

Dữ liệu dùng năm 2020 để không lẫn với booking thật; room_id 9990-9991 để không
đụng các fixture khác. Mọi dòng được dọn sau mỗi test.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.security import TokenPayload, current_user
from app.main import app

pytestmark = pytest.mark.integration

ROOM_USED = 9990
ROOM_IDLE = 9991

client = TestClient(app)


@pytest.fixture(autouse=True)
def _as_admin():
    # Ghi đè fixture autouse của conftest (Employee) — endpoint cần Administrator/Manager
    app.dependency_overrides[current_user] = lambda: TokenPayload(
        sub="report-admin", roles=["Administrator"]
    )
    yield
    app.dependency_overrides.pop(current_user, None)


def _insert_booking(conn, room_id, start, end, status, auto_cancelled=False):
    conn.execute(
        text(
            "INSERT INTO bookings"
            " (room_id, user_id, start_at, end_at, num_attendees, status, auto_cancelled_at)"
            " VALUES (:rid, 'report-user', cast(:s as timestamptz), cast(:e as timestamptz),"
            "  1, :st, CASE WHEN :auto THEN cast(:s as timestamptz) ELSE NULL END)"
        ),
        {"rid": room_id, "s": start, "e": end, "st": status, "auto": auto_cancelled},
    )


@pytest.fixture
def report_data(db_engine):
    with db_engine.connect() as conn:
        for rid, name in ((ROOM_USED, "Report Room Used"), (ROOM_IDLE, "Report Room Idle")):
            conn.execute(
                text(
                    "INSERT INTO room_snapshots (room_id, name, capacity, status, version)"
                    " VALUES (:id, :n, 10, 'AVAILABLE', 1)"
                    " ON CONFLICT (room_id) DO UPDATE SET name = EXCLUDED.name"
                ),
                {"id": rid, "n": name},
            )
        # Tháng 3/2020: 2h CHECKED_IN + 3h CONFIRMED = 5h đã đặt
        _insert_booking(conn, ROOM_USED, "2020-03-10 09:00+00", "2020-03-10 11:00+00", "CHECKED_IN")
        _insert_booking(conn, ROOM_USED, "2020-03-05 09:00+00", "2020-03-05 12:00+00", "CONFIRMED")
        # Tháng 4/2020: 1 hủy tay + 1 hủy tự động (no-show)
        _insert_booking(conn, ROOM_USED, "2020-04-02 14:00+00", "2020-04-02 15:00+00", "CANCELLED")
        _insert_booking(
            conn,
            ROOM_USED,
            "2020-04-03 14:00+00",
            "2020-04-03 15:00+00",
            "CANCELLED",
            auto_cancelled=True,
        )
        conn.commit()
    yield
    with db_engine.connect() as conn:
        conn.execute(
            text("DELETE FROM bookings WHERE room_id IN (:a, :b)"), {"a": ROOM_USED, "b": ROOM_IDLE}
        )
        conn.execute(
            text("DELETE FROM room_snapshots WHERE room_id IN (:a, :b)"),
            {"a": ROOM_USED, "b": ROOM_IDLE},
        )
        conn.commit()


def _stats(start, end):
    resp = client.get("/api/bookings/reports/stats", params={"start_date": start, "end_date": end})
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_auto_cancelled_is_separated_from_manual_cancel(report_data):
    data = _stats("2020-03-01", "2020-04-30")
    assert data["total"] == 4
    assert data["cancelled"] == 2  # tổng hủy = hủy tay + hủy tự động
    assert data["auto_cancelled"] == 1  # chỉ no-show do hệ thống hủy


def test_monthly_stats_groups_by_month(report_data):
    data = _stats("2020-03-01", "2020-04-30")
    assert data["monthly_stats"] == [
        {"month": "2020-03", "total": 2, "checked_in": 1, "cancelled": 0},
        {"month": "2020-04", "total": 2, "checked_in": 0, "cancelled": 2},
    ]


def test_utilisation_rate_is_booked_hours_over_available_hours(report_data):
    # 10 ngày × 10h khả dụng = 100h; đã đặt 5h (booking hủy không tính) → 5.0%
    data = _stats("2020-03-01", "2020-03-10")
    by_room = {r["room_id"]: r for r in data["room_utilisation"]}
    assert by_room[ROOM_USED]["hours_booked"] == 5.0
    assert by_room[ROOM_USED]["bookings"] == 2
    assert by_room[ROOM_USED]["utilisation_rate"] == 5.0


def test_idle_room_is_listed_with_zero_utilisation(report_data):
    data = _stats("2020-03-01", "2020-03-10")
    by_room = {r["room_id"]: r for r in data["room_utilisation"]}
    assert by_room[ROOM_IDLE]["utilisation_rate"] == 0.0
    assert by_room[ROOM_IDLE]["bookings"] == 0


def test_cancelled_hours_do_not_count_as_utilisation(report_data):
    # Tháng 4 chỉ có 2 booking bị hủy → không giờ nào được tính
    data = _stats("2020-04-01", "2020-04-30")
    by_room = {r["room_id"]: r for r in data["room_utilisation"]}
    assert by_room[ROOM_USED]["hours_booked"] == 0.0
