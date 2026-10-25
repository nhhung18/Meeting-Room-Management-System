"""Concurrency integration tests — prove EXCLUDE constraint prevents double-booking.

Tests fire parallel requests at the real booking-service API (via TestClient with
real Postgres). Each thread gets its own connection, simulating multi-instance race
conditions. The PostgreSQL EXCLUDE constraint is the only guard once all pre-checks
race past.

Run: make test-integration
"""

import os
from concurrent.futures import ThreadPoolExecutor, as_completed

import pytest
from fastapi.testclient import TestClient

from app.main import app

pytestmark = pytest.mark.integration

PARALLEL = 10


def _book_room_via_testclient(room_id: int, start: str, end: str) -> int:
    """POST a booking via a fresh TestClient context (own DB connection pool)."""
    with TestClient(app) as client:
        resp = client.post(
            "/api/bookings/",
            json={
                "room_id": room_id,
                "start_at": start,
                "end_at": end,
                "num_attendees": 2,
            },
        )
        return resp.status_code


def test_concurrent_booking_exactly_one_wins(seeded_room_id):
    """Fire PARALLEL identical booking requests in parallel.

    Exactly one must get 201 (EXCLUDE constraint lets it through).
    The rest must get 409 (overlap detected by app pre-check or DB constraint).
    """
    start = "2099-01-01T09:00:00+00:00"
    end = "2099-01-01T10:00:00+00:00"

    with ThreadPoolExecutor(max_workers=PARALLEL) as pool:
        futures = [
            pool.submit(_book_room_via_testclient, seeded_room_id, start, end)
            for _ in range(PARALLEL)
        ]
        statuses = [f.result() for f in as_completed(futures)]

    wins = statuses.count(201)
    conflicts = statuses.count(409)
    assert wins == 1, f"Expected exactly 1×201, got {wins}; all statuses: {statuses}"
    assert conflicts == PARALLEL - 1, (
        f"Expected {PARALLEL - 1}×409, got {conflicts}; all statuses: {statuses}"
    )


def test_adjacent_slots_no_false_conflict(seeded_room_id):
    """Adjacent half-open intervals [09:00,10:00) and [10:00,11:00) must both succeed.

    Proves the EXCLUDE constraint does not over-reject adjacent (non-overlapping) slots
    even under concurrent conditions.
    """
    slot_a = ("2099-02-01T09:00:00+00:00", "2099-02-01T10:00:00+00:00")
    slot_b = ("2099-02-01T10:00:00+00:00", "2099-02-01T11:00:00+00:00")

    with ThreadPoolExecutor(max_workers=2) as pool:
        fa = pool.submit(_book_room_via_testclient, seeded_room_id, *slot_a)
        fb = pool.submit(_book_room_via_testclient, seeded_room_id, *slot_b)
        status_a = fa.result()
        status_b = fb.result()

    assert status_a == 201, f"Slot A should succeed, got {status_a}"
    assert status_b == 201, f"Slot B should succeed, got {status_b}"


@pytest.mark.skipif(
    not os.environ.get("BOOKING_SERVICE_URL"),
    reason="BOOKING_SERVICE_URL not set — skip HTTP-level concurrency test",
)
def test_concurrent_booking_http_level(seeded_room_id):
    """HTTP-level concurrency test against a real Docker container.

    Requires BOOKING_SERVICE_URL env var pointing to the running service.
    Run: BOOKING_SERVICE_URL=http://localhost:8000 make test-integration
    """
    import httpx

    base_url = os.environ["BOOKING_SERVICE_URL"]
    start = "2099-03-01T09:00:00+00:00"
    end = "2099-03-01T10:00:00+00:00"

    def _book_http(room_id: int) -> int:
        resp = httpx.post(
            f"{base_url}/api/bookings/",
            json={
                "room_id": room_id,
                "start_at": start,
                "end_at": end,
                "num_attendees": 2,
            },
            timeout=10,
        )
        return resp.status_code

    with ThreadPoolExecutor(max_workers=PARALLEL) as pool:
        futures = [pool.submit(_book_http, seeded_room_id) for _ in range(PARALLEL)]
        statuses = [f.result() for f in as_completed(futures)]

    wins = statuses.count(201)
    assert wins == 1, f"Expected exactly 1×201, got {wins}; all statuses: {statuses}"
    assert statuses.count(409) == PARALLEL - 1
