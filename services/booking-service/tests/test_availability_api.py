"""Unit tests for availability search endpoint — repo mocked, no real DB."""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest

from app.api.bookings import _get_availability_repo
from app.main import app
from app.models.room_snapshot import RoomSnapshot
from app.repositories.room_snapshot_repository import RoomSnapshotRepository

_NOW = datetime.now(UTC)
_START = (_NOW + timedelta(hours=1)).isoformat()
_END = (_NOW + timedelta(hours=2)).isoformat()


def _make_snapshot(**overrides) -> RoomSnapshot:
    defaults = {
        "room_id": 1,
        "name": "P101",
        "capacity": 10,
        "status": "AVAILABLE",
        "floor": "Tầng 1",
        "equipment": ["projector"],
        "owner_id": None,
        "version": 1,
    }
    defaults.update(overrides)
    snap = MagicMock(spec=RoomSnapshot)
    for k, v in defaults.items():
        setattr(snap, k, v)
    return snap


@pytest.fixture
def mock_repo():
    repo = MagicMock(spec=RoomSnapshotRepository)
    app.dependency_overrides[_get_availability_repo] = lambda: repo
    yield repo
    app.dependency_overrides.pop(_get_availability_repo, None)


class TestSearchAvailable:
    def test_search_returns_200_with_valid_params(self, client, employee_user, mock_repo):
        mock_repo.find_available.return_value = [_make_snapshot()]

        resp = client.get(
            "/api/bookings/rooms/available",
            params={"start_at": _START, "end_at": _END},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["room_id"] == 1

    def test_search_missing_start_at_422(self, client, employee_user, mock_repo):
        resp = client.get(
            "/api/bookings/rooms/available",
            params={"end_at": _END},
        )
        assert resp.status_code == 422

    def test_search_missing_end_at_422(self, client, employee_user, mock_repo):
        resp = client.get(
            "/api/bookings/rooms/available",
            params={"start_at": _START},
        )
        assert resp.status_code == 422

    def test_search_end_before_start_422(self, client, employee_user, mock_repo):
        resp = client.get(
            "/api/bookings/rooms/available",
            params={"start_at": _END, "end_at": _START},
        )
        assert resp.status_code == 422

    def test_search_start_equals_end_422(self, client, employee_user, mock_repo):
        resp = client.get(
            "/api/bookings/rooms/available",
            params={"start_at": _START, "end_at": _START},
        )
        assert resp.status_code == 422

    def test_search_with_capacity_filter(self, client, employee_user, mock_repo):
        mock_repo.find_available.return_value = []

        resp = client.get(
            "/api/bookings/rooms/available",
            params={"start_at": _START, "end_at": _END, "min_capacity": 20},
        )

        assert resp.status_code == 200
        _, kwargs = mock_repo.find_available.call_args
        assert kwargs.get("min_capacity") == 20

    def test_search_with_floor_filter(self, client, employee_user, mock_repo):
        mock_repo.find_available.return_value = []

        resp = client.get(
            "/api/bookings/rooms/available",
            params={"start_at": _START, "end_at": _END, "floor": "Tầng 2"},
        )

        assert resp.status_code == 200
        _, kwargs = mock_repo.find_available.call_args
        assert kwargs.get("floor") == "Tầng 2"

    def test_search_with_equipment_filter(self, client, employee_user, mock_repo):
        mock_repo.find_available.return_value = []

        resp = client.get(
            "/api/bookings/rooms/available",
            params={"start_at": _START, "end_at": _END, "equipment": ["projector"]},
        )

        assert resp.status_code == 200
        _, kwargs = mock_repo.find_available.call_args
        assert kwargs.get("equipment") == ["projector"]

    def test_search_empty_results_200(self, client, employee_user, mock_repo):
        mock_repo.find_available.return_value = []

        resp = client.get(
            "/api/bookings/rooms/available",
            params={"start_at": _START, "end_at": _END},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["items"] == []

    def test_search_no_auth_401(self, client, mock_repo):
        resp = client.get(
            "/api/bookings/rooms/available",
            params={"start_at": _START, "end_at": _END},
        )
        assert resp.status_code == 401
