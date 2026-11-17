"""Fixtures for concurrency integration tests.

Provides seeded_room_id: inserts a test room_snapshot before the test,
cleans up bookings and snapshot after.
"""

import pytest
from sqlalchemy import text

from app.core.security import TokenPayload, current_user
from app.main import app


@pytest.fixture(autouse=True)
def _override_auth_for_integration():
    """Bypass JWT validation in integration tests — no real Auth0 in test env."""
    app.dependency_overrides[current_user] = lambda: TokenPayload(
        sub="integration-test-user", roles=["Employee"]
    )
    yield
    app.dependency_overrides.pop(current_user, None)


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
        conn.execute(text("DELETE FROM room_snapshots WHERE room_id = :id"), {"id": room_id})
        conn.commit()
