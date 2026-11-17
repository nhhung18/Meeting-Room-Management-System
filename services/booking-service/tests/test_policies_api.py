"""Unit tests cho policies API — repository mocked, không cần DB."""

from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest

from app.models.system_policy import SystemPolicy


def _make_policy(**overrides) -> SystemPolicy:
    log = MagicMock(spec=SystemPolicy)
    log.key = overrides.get("key", "check_in_window_minutes")
    log.value = overrides.get("value", 15)
    log.description = overrides.get("description", "Cửa sổ check-in (phút).")
    log.updated_by = overrides.get("updated_by")
    log.updated_at = overrides.get("updated_at", datetime.now(UTC))
    return log


@pytest.fixture(autouse=True)
def _mock_db(mock_db):
    pass


@pytest.fixture
def mock_repo(monkeypatch):
    """Patch SystemPolicyRepository constructor để trả mock."""
    from app.api import policies as policies_module

    repo = MagicMock()
    monkeypatch.setattr(policies_module, "SystemPolicyRepository", lambda db: repo)
    return repo


@pytest.fixture
def mock_policy_svc(monkeypatch):
    svc = MagicMock()
    from app.api import policies as policies_module

    monkeypatch.setattr(policies_module, "get_policy_service", lambda: svc)
    return svc


class TestListPolicies:
    def test_list_returns_200(self, client, admin_user, mock_repo):
        mock_repo.list_all.return_value = [_make_policy()]
        resp = client.get("/api/bookings/policies/")
        assert resp.status_code == 200
        assert resp.json()["items"][0]["key"] == "check_in_window_minutes"

    def test_list_requires_admin(self, client, employee_user, mock_repo):
        resp = client.get("/api/bookings/policies/")
        assert resp.status_code == 403

    def test_list_empty(self, client, admin_user, mock_repo):
        mock_repo.list_all.return_value = []
        resp = client.get("/api/bookings/policies/")
        assert resp.status_code == 200
        assert resp.json()["items"] == []


class TestGetPolicy:
    def test_get_returns_200(self, client, admin_user, mock_repo):
        mock_repo.get.return_value = _make_policy(value=30)
        resp = client.get("/api/bookings/policies/check_in_window_minutes")
        assert resp.status_code == 200
        assert resp.json()["value"] == 30

    def test_get_not_found_404(self, client, admin_user, mock_repo):
        mock_repo.get.return_value = None
        resp = client.get("/api/bookings/policies/nonexistent")
        assert resp.status_code == 404


class TestUpdatePolicy:
    def test_update_valid_value_200(self, client, admin_user, mock_repo, mock_policy_svc):
        mock_repo.upsert.return_value = _make_policy(value=30, updated_by="admin1")
        resp = client.patch(
            "/api/bookings/policies/check_in_window_minutes",
            json={"value": 30},
        )
        assert resp.status_code == 200
        assert resp.json()["value"] == 30
        mock_repo.upsert.assert_called_once()
        mock_policy_svc.invalidate.assert_called_once_with("check_in_window_minutes")

    def test_update_invalid_type_422(self, client, admin_user, mock_repo):
        resp = client.patch(
            "/api/bookings/policies/check_in_window_minutes",
            json={"value": "not-a-number"},
        )
        assert resp.status_code == 422

    def test_update_out_of_range_422(self, client, admin_user, mock_repo):
        resp = client.patch(
            "/api/bookings/policies/check_in_window_minutes",
            json={"value": 200},
        )
        assert resp.status_code == 422

    def test_update_zero_rejected_422(self, client, admin_user, mock_repo):
        resp = client.patch(
            "/api/bookings/policies/check_in_window_minutes",
            json={"value": 0},
        )
        assert resp.status_code == 422

    def test_update_unknown_key_404(self, client, admin_user, mock_repo):
        resp = client.patch(
            "/api/bookings/policies/unknown_key",
            json={"value": 10},
        )
        assert resp.status_code == 404

    def test_update_requires_admin(self, client, employee_user, mock_repo):
        resp = client.patch(
            "/api/bookings/policies/check_in_window_minutes",
            json={"value": 30},
        )
        assert resp.status_code == 403
