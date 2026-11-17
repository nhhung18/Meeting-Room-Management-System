"""Unit tests for security module — anonymous dev mode and require_admin."""

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

    def _clear_caches(self):
        from app.core import security as sec
        from app.core.config import get_settings
        sec.get_jwt_validator.cache_clear()
        get_settings.cache_clear()

    def test_returns_anonymous_admin(self, monkeypatch):
        monkeypatch.delenv("AUTH0_DOMAIN", raising=False)
        monkeypatch.delenv("AUTH0_AUDIENCE", raising=False)
        self._clear_caches()
        app = _app_with_routes()
        client = TestClient(app)
        resp = client.get("/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["sub"] == "anonymous"
        assert "Administrator" in data["roles"]
        self._clear_caches()

    def test_admin_endpoint_accessible_in_anonymous_mode(self, monkeypatch):
        monkeypatch.delenv("AUTH0_DOMAIN", raising=False)
        monkeypatch.delenv("AUTH0_AUDIENCE", raising=False)
        self._clear_caches()
        app = _app_with_routes()
        client = TestClient(app)
        resp = client.get("/admin-only")
        assert resp.status_code == 200
        self._clear_caches()


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

    def test_with_roles(self):
        tp = TokenPayload(sub="u", roles=["Employee"])
        assert "Employee" in tp.roles


class TestAuthEnabledMode:
    """When AUTH0_DOMAIN is set, real JWT validation is enforced."""

    def _set_auth_env_and_clear(self, monkeypatch):
        from app.core import security as sec
        from app.core.config import get_settings
        monkeypatch.setenv("AUTH0_DOMAIN", "test.auth0.com")
        monkeypatch.setenv("AUTH0_AUDIENCE", "https://mrms.api")
        sec.get_jwt_validator.cache_clear()
        get_settings.cache_clear()

    def _clear_caches(self):
        from app.core import security as sec
        from app.core.config import get_settings
        sec.get_jwt_validator.cache_clear()
        get_settings.cache_clear()

    def test_missing_auth_header_returns_401(self, monkeypatch):
        """With AUTH0_DOMAIN set, missing Authorization header → 401."""
        self._set_auth_env_and_clear(monkeypatch)
        app = _app_with_routes()
        client = TestClient(app)
        resp = client.get("/me")
        assert resp.status_code == 401
        self._clear_caches()

    def test_invalid_bearer_token_returns_401(self, monkeypatch):
        """With AUTH0_DOMAIN set, malformed Bearer token → 401."""
        self._set_auth_env_and_clear(monkeypatch)
        app = _app_with_routes()
        client = TestClient(app)
        resp = client.get("/me", headers={"Authorization": "Bearer not-a-real-jwt"})
        assert resp.status_code == 401
        self._clear_caches()
