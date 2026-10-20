"""Integration tests for booking_db schema constraints.

Requires real Postgres with migration applied.
Run: make test-integration (not make test — DB-free unit tests skip this file).

Tests pin the three behaviors guaranteed by the EXCLUDE constraint + half-open interval:
  1. Overlapping booking on same room → rejected
  2. Adjacent half-open intervals [09,10) and [10,11) → allowed (assumption #1)
  3. CANCELLED booking does not block a new one on same slot (WHERE clause in constraint)
"""

import pytest
import sqlalchemy.exc
from sqlalchemy import text

pytestmark = pytest.mark.integration


def _insert(conn, start: str, end: str, status: str = "CONFIRMED") -> None:
    # Use CAST() instead of ::timestamptz cast: the :: operator conflicts with SQLAlchemy
    # named-parameter syntax (:param), producing a parse error.
    conn.execute(
        text(
            "INSERT INTO bookings (room_id, user_id, start_at, end_at, num_attendees, status)"
            " VALUES (1, 'test_user', CAST(:s AS timestamptz), CAST(:e AS timestamptz), 2, :st)"
        ),
        {"s": start, "e": end, "st": status},
    )


def test_overlap_rejected(db_conn) -> None:
    """Two CONFIRMED bookings on same room with overlapping times → IntegrityError."""
    _insert(db_conn, "2026-10-20T09:00:00+00", "2026-10-20T10:00:00+00")
    with pytest.raises(sqlalchemy.exc.IntegrityError):  # wraps psycopg ExclusionViolation
        _insert(db_conn, "2026-10-20T09:30:00+00", "2026-10-20T10:30:00+00")


def test_half_open_adjacent_allowed(db_conn) -> None:
    """[09:00, 10:00) and [10:00, 11:00) are adjacent, not overlapping → both succeed."""
    _insert(db_conn, "2026-10-20T09:00:00+00", "2026-10-20T10:00:00+00")
    _insert(db_conn, "2026-10-20T10:00:00+00", "2026-10-20T11:00:00+00")  # must not raise


def test_cancelled_overlap_allowed(db_conn) -> None:
    """A CANCELLED booking does not block a new booking on the same slot."""
    _insert(db_conn, "2026-10-20T09:00:00+00", "2026-10-20T10:00:00+00", status="CANCELLED")
    _insert(db_conn, "2026-10-20T09:30:00+00", "2026-10-20T10:30:00+00")  # must not raise
