"""Fixtures for concurrency integration tests.

Provides seeded_room_id: inserts a test room_snapshot before the test,
cleans up bookings and snapshot after.
"""

import pytest
from sqlalchemy import text


@pytest.fixture
def seeded_room_id(db_engine):
    """Insert a room_snapshot row and return its room_id. Clean up after test."""
    room_id = 9999
    with db_engine.connect() as conn:
        conn.execute(
            text(
                "INSERT INTO room_snapshots (room_id, name, capacity, status, version)"
                " VALUES (:id, 'Concurrency Test Room', 50, 'AVAILABLE', 1)"
                " ON CONFLICT (room_id) DO UPDATE SET status = 'AVAILABLE'"
            ),
            {"id": room_id},
        )
        conn.commit()
    yield room_id
    with db_engine.connect() as conn:
        conn.execute(text("DELETE FROM bookings WHERE room_id = :id"), {"id": room_id})
        conn.execute(
            text("DELETE FROM room_snapshots WHERE room_id = :id"), {"id": room_id}
        )
        conn.commit()
