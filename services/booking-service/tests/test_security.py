"""Unit tests for security module — anonymous dev mode and require_admin."""

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.core.security import TokenPayload, current_user, require_admin


def _app_with_routes() -> FastAPI:
    """Minimal app to test security dependencies in isolation."""
    test_app = FastAPI()

    @test_app.get("/me")
    def me(user: TokenPayload = Depends(current_user)):
        return {"sub": user.sub, "roles": user.roles}

    @test_app.get("/admin-only")
    def admin_only(user: TokenPayload = Depends(require_admin)):
        return {"sub": user.sub}

    return test_app


class TestAnonymousMode:
    """When AUTH0_DOMAIN is not set, current_user returns anonymous admin."""

    def test_returns_anonymous_admin(self, monkeypatch):
        monkeypatch.delenv("AUTH0_DOMAIN", raising=False)
        app = _app_with_routes()
        client = TestClient(app)
        resp = client.get("/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["sub"] == "anonymous"
        assert "Administrator" in data["roles"]

    def test_admin_endpoint_accessible_in_anonymous_mode(self, monkeypatch):
        monkeypatch.delenv("AUTH0_DOMAIN", raising=False)
        app = _app_with_routes()
        client = TestClient(app)
        resp = client.get("/admin-only")
        assert resp.status_code == 200


class TestRequireAdmin:
    def test_non_admin_gets_403(self):
        app = _app_with_routes()
        app.dependency_overrides[current_user] = lambda: TokenPayload(
            sub="emp1", roles=["Employee"]
        )
        client = TestClient(app)
        resp = client.get("/admin-only")
        assert resp.status_code == 403
        app.dependency_overrides.clear()

    def test_admin_passes(self):
        app = _app_with_routes()
        app.dependency_overrides[current_user] = lambda: TokenPayload(
            sub="admin1", roles=["Administrator"]
        )
        client = TestClient(app)
        resp = client.get("/admin-only")
        assert resp.status_code == 200
        app.dependency_overrides.clear()

    def test_manager_not_admin_gets_403(self):
        app = _app_with_routes()
        app.dependency_overrides[current_user] = lambda: TokenPayload(
            sub="mgr1", roles=["Room Manager"]
        )
        client = TestClient(app)
        resp = client.get("/admin-only")
        assert resp.status_code == 403
        app.dependency_overrides.clear()


class TestTokenPayload:
    def test_defaults(self):
        tp = TokenPayload(sub="user1")
        assert tp.roles == []
        assert tp.email is None

    def test_with_roles(self):
        tp = TokenPayload(sub="u", roles=["Employee"])
        assert "Employee" in tp.roles
