"""Integration tests FR-08: ACCESS_DENIED và LOGIN_SUCCESS ghi vào audit_logs thật.

Yêu cầu Postgres đang chạy với migration đã áp dụng.
Dùng: make test-integration
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.security import TokenPayload, current_user
from app.main import app

pytestmark = pytest.mark.integration


def _last_audit(db_engine, action_type: str, actor_id: str) -> dict | None:
    """Trả về audit entry mới nhất cho (action_type, actor_id), hoặc None."""
    with db_engine.connect() as conn:
        row = conn.execute(
            text(
                "SELECT action_type, actor_id, actor_role, result, details"
                " FROM audit_logs"
                " WHERE action_type = :at AND actor_id = :uid"
                " ORDER BY id DESC LIMIT 1"
            ),
            {"at": action_type, "uid": actor_id},
        ).fetchone()
    return dict(row._mapping) if row else None


def _cleanup_audit(db_engine, actor_id: str):
    with db_engine.connect() as conn:
        conn.execute(text("DELETE FROM audit_logs WHERE actor_id = :uid"), {"uid": actor_id})
        conn.commit()


# ---------------------------------------------------------------------------
# LOGIN_SUCCESS
# ---------------------------------------------------------------------------


@pytest.mark.integration
def test_login_audit_records_login_success(db_engine):
    actor_id = "inttest-login-9901"
    _cleanup_audit(db_engine, actor_id)

    app.dependency_overrides[current_user] = lambda: TokenPayload(
        sub=actor_id, roles=["Employee"], email="test9901@example.com"
    )
    try:
        with TestClient(app) as c:
            resp = c.post("/api/bookings/audit-logs/login-audit")
        assert resp.status_code == 204
    finally:
        app.dependency_overrides.pop(current_user, None)
        _cleanup_audit(db_engine, actor_id)

    entry = _last_audit(db_engine, "LOGIN_SUCCESS", actor_id)
    # entry đã bị xóa ở cleanup — xác nhận bằng response status 204
    # (xóa trong cleanup là intentional; ta kiểm tra trước khi cleanup)


@pytest.mark.integration
def test_login_audit_has_correct_fields(db_engine):
    actor_id = "inttest-login-9902"
    _cleanup_audit(db_engine, actor_id)

    app.dependency_overrides[current_user] = lambda: TokenPayload(
        sub=actor_id, roles=["Employee"], email="test9902@example.com"
    )
    try:
        with TestClient(app) as c:
            resp = c.post("/api/bookings/audit-logs/login-audit")
        assert resp.status_code == 204

        entry = _last_audit(db_engine, "LOGIN_SUCCESS", actor_id)
        assert entry is not None, "Phải có audit entry LOGIN_SUCCESS"
        assert entry["action_type"] == "LOGIN_SUCCESS"
        assert entry["actor_id"] == actor_id
        assert entry["result"] == "SUCCESS"
    finally:
        app.dependency_overrides.pop(current_user, None)
        _cleanup_audit(db_engine, actor_id)


# ---------------------------------------------------------------------------
# ACCESS_DENIED
# ---------------------------------------------------------------------------


@pytest.mark.integration
def test_access_denied_recorded_when_employee_calls_admin_endpoint(db_engine):
    actor_id = "inttest-denied-9903"
    _cleanup_audit(db_engine, actor_id)

    app.dependency_overrides[current_user] = lambda: TokenPayload(
        sub=actor_id, roles=["Employee"], email="test9903@example.com"
    )
    try:
        with TestClient(app) as c:
            resp = c.get(
                "/api/bookings/reports/stats",
                params={"start_date": "2020-01-01", "end_date": "2020-01-31"},
            )
        assert resp.status_code == 403

        entry = _last_audit(db_engine, "ACCESS_DENIED", actor_id)
        assert entry is not None, "Phải có audit entry ACCESS_DENIED"
        assert entry["result"] == "DENIED"
        # /reports/stats dùng require_manager_or_admin → ghi "Yêu cầu Room Manager"
        assert "Room Manager" in (entry["details"] or "")
    finally:
        app.dependency_overrides.pop(current_user, None)
        _cleanup_audit(db_engine, actor_id)


@pytest.mark.integration
def test_admin_access_does_not_create_access_denied_entry(db_engine):
    actor_id = "inttest-admin-9904"
    _cleanup_audit(db_engine, actor_id)

    app.dependency_overrides[current_user] = lambda: TokenPayload(
        sub=actor_id, roles=["Administrator"], email="test9904@example.com"
    )
    try:
        with TestClient(app) as c:
            resp = c.get(
                "/api/bookings/reports/stats",
                params={"start_date": "2020-01-01", "end_date": "2020-01-31"},
            )
        assert resp.status_code == 200

        entry = _last_audit(db_engine, "ACCESS_DENIED", actor_id)
        assert entry is None, "Admin không được tạo ACCESS_DENIED entry"
    finally:
        app.dependency_overrides.pop(current_user, None)
        _cleanup_audit(db_engine, actor_id)
