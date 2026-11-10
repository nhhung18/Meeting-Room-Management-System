"""Unit tests cho Audit Log API — repo mocked, no DB."""

from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest

from app.main import app
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogListResponse, AuditLogResponse


_NOW = datetime.now(UTC)


def _make_log(**kwargs) -> AuditLog:
    log = MagicMock(spec=AuditLog)
    log.id = kwargs.get("id", 1)
    log.actor_id = kwargs.get("actor_id", "user-1")
    log.actor_roles = kwargs.get("actor_roles", ["Employee"])
    log.action = kwargs.get("action", "CREATE")
    log.resource_type = kwargs.get("resource_type", "booking")
    log.resource_id = kwargs.get("resource_id", 42)
    log.before_snapshot = kwargs.get("before_snapshot", None)
    log.after_snapshot = kwargs.get("after_snapshot", {"id": 42, "status": "CONFIRMED"})
    log.request_id = kwargs.get("request_id", "req-123")
    log.created_at = kwargs.get("created_at", _NOW)
    return log


@pytest.fixture(autouse=True)
def _mock_db(mock_db):
    pass


@pytest.fixture
def mock_repo():
    from app.api import audit_logs as audit_logs_module

    repo = MagicMock()
    app.dependency_overrides[audit_logs_module._get_audit_repo] = lambda db=None: repo
    yield repo
    app.dependency_overrides.pop(audit_logs_module._get_audit_repo, None)


class TestAuditLogList:
    def test_list_returns_200(self, client, admin_user, mock_repo):
        mock_repo.list_logs.return_value = ([_make_log()], 1)
        resp = client.get("/api/bookings/audit-logs/")
        assert resp.status_code == 200

    def test_list_requires_admin(self, client, employee_user, mock_repo):
        mock_repo.list_logs.return_value = ([], 0)
        resp = client.get("/api/bookings/audit-logs/")
        assert resp.status_code == 403

    def test_list_shape(self, client, admin_user, mock_repo):
        mock_repo.list_logs.return_value = ([_make_log()], 1)
        resp = client.get("/api/bookings/audit-logs/")
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] == 1
        assert data["items"][0]["action"] == "CREATE"

    def test_list_passes_filters(self, client, admin_user, mock_repo):
        mock_repo.list_logs.return_value = ([], 0)
        resp = client.get("/api/bookings/audit-logs/?resource_id=42&actor_id=user-1&action=CANCEL")
        assert resp.status_code == 200
        mock_repo.list_logs.assert_called_once()
        call_kwargs = mock_repo.list_logs.call_args.kwargs
        assert call_kwargs["resource_id"] == 42
        assert call_kwargs["actor_id"] == "user-1"
        assert call_kwargs["action"] == "CANCEL"

    def test_list_empty(self, client, admin_user, mock_repo):
        mock_repo.list_logs.return_value = ([], 0)
        resp = client.get("/api/bookings/audit-logs/")
        assert resp.json()["total"] == 0
        assert resp.json()["items"] == []
