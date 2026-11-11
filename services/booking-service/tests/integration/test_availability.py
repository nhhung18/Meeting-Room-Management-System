"""Integration tests for the availability search endpoint."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app

_NOW = datetime.now(UTC)
_START = _NOW + timedelta(hours=24)
_END = _START + timedelta(hours=1)

client = TestClient(app)


def _snap_insert(conn, room_id, name, capacity, status="AVAILABLE", floor=None, equipment=None):
    import json

    conn.execute(
        text(
            "INSERT INTO room_snapshots (room_id, name, capacity, status, floor, equipment, version)"
            " VALUES (:id, :name, :cap, :status, :floor, cast(:equip as jsonb), 1)"
            " ON CONFLICT (room_id) DO UPDATE SET name=EXCLUDED.name, capacity=EXCLUDED.capacity,"
            "  status=EXCLUDED.status, floor=EXCLUDED.floor, equipment=EXCLUDED.equipment"
        ),
        {
            "id": room_id,
            "name": name,
            "cap": capacity,
            "status": status,
            "floor": floor,
            "equip": json.dumps(equipment or []),
        },
    )


def _booking_insert(conn, room_id, start_at, end_at, status="CONFIRMED"):
    conn.execute(
        text(
            "INSERT INTO bookings (room_id, user_id, start_at, end_at, num_attendees, status)"
            " VALUES (:rid, 'test-user', :s, :e, 1, :status)"
        ),
        {"rid": room_id, "s": start_at, "e": end_at, "status": status},
    )


@pytest.fixture
def clean_db(db_engine):
    yield
    with db_engine.connect() as conn:
        conn.execute(text("DELETE FROM bookings WHERE room_id >= 8000"))
        conn.execute(text("DELETE FROM room_snapshots WHERE room_id >= 8000"))
        conn.commit()


@pytest.mark.integration
class TestAvailabilitySearch:
    def test_available_room_returned(self, db_engine, clean_db):
        with db_engine.connect() as conn:
            _snap_insert(conn, 8001, "Room A", 10)
            conn.commit()

        resp = client.get(
            "/api/bookings/rooms/available",
            params={"start_at": _START.isoformat(), "end_at": _END.isoformat()},
        )

        assert resp.status_code == 200
        data = resp.json()
        ids = [r["room_id"] for r in data["items"]]
        assert 8001 in ids

    def test_booked_room_excluded(self, db_engine, clean_db):
        with db_engine.connect() as conn:
            _snap_insert(conn, 8002, "Room B", 10)
            _booking_insert(conn, 8002, _START, _END, status="CONFIRMED")
            conn.commit()

        resp = client.get(
            "/api/bookings/rooms/available",
            params={"start_at": _START.isoformat(), "end_at": _END.isoformat()},
        )

        assert resp.status_code == 200
        ids = [r["room_id"] for r in resp.json()["items"]]
        assert 8002 not in ids

    def test_cancelled_booking_does_not_block(self, db_engine, clean_db):
        with db_engine.connect() as conn:
            _snap_insert(conn, 8003, "Room C", 10)
            _booking_insert(conn, 8003, _START, _END, status="CANCELLED")
            conn.commit()

        resp = client.get(
            "/api/bookings/rooms/available",
            params={"start_at": _START.isoformat(), "end_at": _END.isoformat()},
        )

        assert resp.status_code == 200
        ids = [r["room_id"] for r in resp.json()["items"]]
        assert 8003 in ids

    def test_filter_by_capacity(self, db_engine, clean_db):
        with db_engine.connect() as conn:
            _snap_insert(conn, 8004, "Small", 5)
            _snap_insert(conn, 8005, "Large", 20)
            conn.commit()

        resp = client.get(
            "/api/bookings/rooms/available",
            params={"start_at": _START.isoformat(), "end_at": _END.isoformat(), "min_capacity": 15},
        )

        assert resp.status_code == 200
        ids = [r["room_id"] for r in resp.json()["items"]]
        assert 8004 not in ids
        assert 8005 in ids

    def test_filter_by_equipment(self, db_engine, clean_db):
        with db_engine.connect() as conn:
            _snap_insert(conn, 8006, "Proj Room", 10, equipment=["projector", "whiteboard"])
            _snap_insert(conn, 8007, "Basic Room", 10, equipment=[])
            conn.commit()

        # Search with projector — only 8006 should appear (Review Focus #2)
        resp = client.get(
            "/api/bookings/rooms/available",
            params={
                "start_at": _START.isoformat(),
                "end_at": _END.isoformat(),
                "equipment": ["projector"],
            },
        )
        assert resp.status_code == 200
        ids = [r["room_id"] for r in resp.json()["items"]]
        assert 8006 in ids
        assert 8007 not in ids

        # Search with hologram — nobody has it (Review Focus #2)
        resp2 = client.get(
            "/api/bookings/rooms/available",
            params={
                "start_at": _START.isoformat(),
                "end_at": _END.isoformat(),
                "equipment": ["hologram"],
            },
        )
        assert resp2.status_code == 200
        ids2 = [r["room_id"] for r in resp2.json()["items"]]
        assert 8006 not in ids2

    def test_filter_by_floor(self, db_engine, clean_db):
        with db_engine.connect() as conn:
            _snap_insert(conn, 8008, "Floor1 Room", 10, floor="Tầng 1")
            _snap_insert(conn, 8009, "Floor2 Room", 10, floor="Tầng 2")
            conn.commit()

        resp = client.get(
            "/api/bookings/rooms/available",
            params={
                "start_at": _START.isoformat(),
                "end_at": _END.isoformat(),
                "floor": "Tầng 2",
            },
        )

        assert resp.status_code == 200
        ids = [r["room_id"] for r in resp.json()["items"]]
        assert 8008 not in ids
        assert 8009 in ids

    def test_maintenance_room_excluded(self, db_engine, clean_db):
        with db_engine.connect() as conn:
            _snap_insert(conn, 8010, "Maint Room", 10, status="MAINTENANCE")
            conn.commit()

        resp = client.get(
            "/api/bookings/rooms/available",
            params={"start_at": _START.isoformat(), "end_at": _END.isoformat()},
        )

        assert resp.status_code == 200
        ids = [r["room_id"] for r in resp.json()["items"]]
        assert 8010 not in ids
