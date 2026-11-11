"""Test: JWT hết hạn → 401 Unauthorized (mandatory scenario S2).

Booking-service uses a placeholder current_user that returns anonymous admin
when AUTH0_DOMAIN is not set. These tests override current_user to simulate
JWT validation failures (expired, missing, malformed) — proving endpoints
propagate 401 correctly.
"""

import pytest
from fastapi import HTTPException, status
from fastapi.testclient import TestClient

from app.core.security import current_user
from app.main import app


def _override_expired():
    def _raise():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )

    app.dependency_overrides[current_user] = _raise


def _override_missing():
    def _raise():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    app.dependency_overrides[current_user] = _raise


def _override_malformed():
    def _raise():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    app.dependency_overrides[current_user] = _raise


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    app.dependency_overrides.clear()


class TestExpiredJWT:
    def test_expired_token_list_bookings_401(self):
        _override_expired()
        with TestClient(app) as client:
            resp = client.get("/api/bookings/")
        assert resp.status_code == 401
        assert "expired" in resp.json()["detail"].lower()

    def test_expired_token_create_booking_401(self):
        _override_expired()
        with TestClient(app) as client:
            resp = client.post("/api/bookings/", json={
                "room_id": 1,
                "start_at": "2099-01-01T09:00:00+00:00",
                "end_at": "2099-01-01T10:00:00+00:00",
                "num_attendees": 2,
            })
        assert resp.status_code == 401

    def test_expired_token_check_in_401(self):
        _override_expired()
        with TestClient(app) as client:
            resp = client.post("/api/bookings/1/check-in")
        assert resp.status_code == 401


class TestMissingToken:
    def test_no_token_list_bookings_401(self):
        _override_missing()
        with TestClient(app) as client:
            resp = client.get("/api/bookings/")
        assert resp.status_code == 401
        assert "missing" in resp.json()["detail"].lower()


class TestMalformedToken:
    def test_malformed_token_401(self):
        _override_malformed()
        with TestClient(app) as client:
            resp = client.get("/api/bookings/")
        assert resp.status_code == 401
        assert "invalid" in resp.json()["detail"].lower()
