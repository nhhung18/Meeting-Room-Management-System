"""Integration tests cho rooms table constraints — chạy trên DB thật.

Mỗi test dùng fixture `db_conn` (transaction rollback sau khi xong) nên
không để lại data giữa các tests.

Chạy: make test-room-integration
"""

import pytest
from sqlalchemy.exc import IntegrityError

pytestmark = pytest.mark.integration

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

INSERT_ROOM = """
    INSERT INTO rooms (name, capacity)
    VALUES (:name, :capacity)
"""

INSERT_ROOM_FULL = """
    INSERT INTO rooms (name, capacity, status, equipment, owner_id, deleted_at)
    VALUES (:name, :capacity, :status, CAST(:equipment AS jsonb), :owner_id, :deleted_at)
"""

SELECT_ROOM = "SELECT * FROM rooms WHERE name = :name"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_capacity_must_be_positive(db_conn):
    """CHECK constraint ck_rooms_capacity_positive: capacity > 0."""
    with pytest.raises(IntegrityError):
        db_conn.execute(
            __import__("sqlalchemy").text(INSERT_ROOM),
            {"name": "P_cap_zero", "capacity": 0},
        )


def test_status_must_be_valid(db_conn):
    """CHECK constraint ck_rooms_status: status IN (AVAILABLE, MAINTENANCE, ARCHIVED)."""
    with pytest.raises(IntegrityError):
        db_conn.execute(
            __import__("sqlalchemy").text(INSERT_ROOM_FULL),
            {
                "name": "P_bad_status",
                "capacity": 10,
                "status": "INVALID",
                "equipment": "[]",
                "owner_id": None,
                "deleted_at": None,
            },
        )


def test_duplicate_name_rejected_for_active_rooms(db_conn):
    """Partial unique index uq_rooms_name_active: hai active rooms không được cùng tên."""
    from sqlalchemy import text

    db_conn.execute(text(INSERT_ROOM), {"name": "P_dup", "capacity": 5})
    with pytest.raises(IntegrityError):
        db_conn.execute(text(INSERT_ROOM), {"name": "P_dup", "capacity": 8})


def test_duplicate_name_allowed_when_one_is_deleted(db_conn):
    """Partial unique index chỉ áp dụng WHERE deleted_at IS NULL.

    Tên đã soft-delete có thể được tái dùng bởi room active mới.
    """
    from datetime import UTC, datetime

    from sqlalchemy import text

    db_conn.execute(
        text(INSERT_ROOM_FULL),
        {
            "name": "P_reuse",
            "capacity": 5,
            "status": "AVAILABLE",
            "equipment": "[]",
            "owner_id": None,
            "deleted_at": datetime.now(UTC),
        },
    )
    # Same name but active — should NOT raise
    db_conn.execute(text(INSERT_ROOM), {"name": "P_reuse", "capacity": 8})


def test_equipment_defaults_to_empty_array(db_conn):
    """Server default '[]'::jsonb cho cột equipment."""
    from sqlalchemy import text

    db_conn.execute(text(INSERT_ROOM), {"name": "P_equip_default", "capacity": 10})
    row = db_conn.execute(text(SELECT_ROOM), {"name": "P_equip_default"}).mappings().one()
    assert row["equipment"] == []


def test_status_defaults_to_available(db_conn):
    """Server default 'AVAILABLE' cho cột status."""
    from sqlalchemy import text

    db_conn.execute(text(INSERT_ROOM), {"name": "P_status_default", "capacity": 10})
    row = db_conn.execute(text(SELECT_ROOM), {"name": "P_status_default"}).mappings().one()
    assert row["status"] == "AVAILABLE"
