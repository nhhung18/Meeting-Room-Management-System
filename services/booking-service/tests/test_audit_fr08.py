"""Unit tests FR-08: ACCESS_DENIED và LOGIN_SUCCESS.

Dùng mock_db để kiểm tra write_audit() được gọi đúng action_type và result.
"""

from unittest.mock import MagicMock, call, patch

import pytest

LOGIN_URL = "/api/bookings/audit-logs/login-audit"
REPORTS_URL = "/api/bookings/reports/stats"
REPORTS_PARAMS = {"start_date": "2026-11-01", "end_date": "2026-11-30"}


# ---------------------------------------------------------------------------
# LOGIN_SUCCESS
# ---------------------------------------------------------------------------


class TestLoginAudit:
    def test_authenticated_user_gets_204(self, client, admin_user, mock_db):
        resp = client.post(LOGIN_URL)
        assert resp.status_code == 204

    def test_employee_also_gets_204(self, client, employee_user, mock_db):
        resp = client.post(LOGIN_URL)
        assert resp.status_code == 204

    def test_unauthenticated_gets_401(self, client, auth_required):
        resp = client.post(LOGIN_URL)
        assert resp.status_code == 401

    def test_writes_login_success_audit(self, client, admin_user, mock_db):
        with patch("app.api.audit_logs.write_audit") as mock_write:
            client.post(LOGIN_URL)
        mock_write.assert_called_once()
        _db, _actor_id, _roles, action_type = mock_write.call_args.args
        assert action_type == "LOGIN_SUCCESS"
        assert mock_write.call_args.kwargs.get("result") == "SUCCESS"


# ---------------------------------------------------------------------------
# ACCESS_DENIED (via require_admin when employee calls admin endpoint)
# ---------------------------------------------------------------------------


class TestAccessDeniedAudit:
    def _empty_reports(self, mock_db):
        mock_db.execute.return_value.all.return_value = []
        mock_db.scalar.return_value = 0

    def test_employee_on_admin_endpoint_gets_403(self, client, employee_user, mock_db):
        self._empty_reports(mock_db)
        resp = client.get(REPORTS_URL, params=REPORTS_PARAMS)
        assert resp.status_code == 403

    def test_access_denied_writes_audit(self, client, employee_user, mock_db):
        self._empty_reports(mock_db)
        with patch("app.core.security.write_audit") as mock_write:
            client.get(REPORTS_URL, params=REPORTS_PARAMS)
        mock_write.assert_called_once()
        _db, _actor_id, _roles, action_type = mock_write.call_args.args
        assert action_type == "ACCESS_DENIED"
        assert mock_write.call_args.kwargs.get("result") == "DENIED"

    def test_admin_on_admin_endpoint_no_access_denied_audit(self, client, admin_user, mock_db):
        self._empty_reports(mock_db)
        with patch("app.core.security.write_audit") as mock_write:
            resp = client.get(REPORTS_URL, params=REPORTS_PARAMS)
        assert resp.status_code == 200
        mock_write.assert_not_called()
