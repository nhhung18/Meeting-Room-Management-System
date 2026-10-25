"""Unit tests cho JWT validation và RBAC — dùng self-signed RSA keys, không gọi Auth0."""

import time
from unittest.mock import MagicMock

import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from common.auth import ROLES_CLAIM, AuthError, JWTValidator, TokenPayload, require_roles

# ---------------------------------------------------------------------------
# Fixtures: RSA keypair + helper tạo JWT
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def rsa_keypair():
    """Tạo RSA keypair dùng cho toàn bộ module tests."""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    return private_key, public_key


@pytest.fixture(scope="module")
def private_pem(rsa_keypair):
    private_key, _ = rsa_keypair
    return private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )


def _make_token(
    private_pem: bytes,
    *,
    sub: str = "auth0|user123",
    aud: str = "https://mrms.api",
    iss: str = "https://test.auth0.com/",
    roles: list[str] | None = None,
    exp: int | None = None,
) -> str:
    """Helper: sign JWT với private key."""
    payload = {
        "sub": sub,
        "aud": aud,
        "iss": iss,
        "exp": exp or int(time.time()) + 3600,
        ROLES_CLAIM: roles or [],
        "permissions": [],
    }
    return pyjwt.encode(payload, private_pem, algorithm="RS256")


# ---------------------------------------------------------------------------
# JWTValidator tests
# ---------------------------------------------------------------------------


class TestJWTValidatorDecode:
    def _make_validator(self, rsa_keypair, domain="test.auth0.com", audience="https://mrms.api"):
        """Tạo JWTValidator với mocked JWKS client."""
        _, public_key = rsa_keypair
        validator = JWTValidator.__new__(JWTValidator)
        validator._audience = audience
        validator._issuer = f"https://{domain}/"

        mock_jwks = MagicMock()
        mock_signing_key = MagicMock()
        mock_signing_key.key = public_key
        mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key
        validator._jwks_client = mock_jwks

        return validator

    def test_decode_valid_token(self, rsa_keypair, private_pem):
        validator = self._make_validator(rsa_keypair)
        token = _make_token(private_pem, roles=["Employee"])

        result = validator.decode(token)

        assert isinstance(result, TokenPayload)
        assert result.sub == "auth0|user123"
        assert result.roles == ["Employee"]

    def test_decode_expired_token(self, rsa_keypair, private_pem):
        validator = self._make_validator(rsa_keypair)
        token = _make_token(private_pem, exp=int(time.time()) - 100)

        with pytest.raises(AuthError) as exc_info:
            validator.decode(token)
        assert exc_info.value.status_code == 401
        assert "expired" in exc_info.value.detail.lower()

    def test_decode_wrong_audience(self, rsa_keypair, private_pem):
        validator = self._make_validator(rsa_keypair, audience="https://wrong.api")
        token = _make_token(private_pem, aud="https://mrms.api")

        with pytest.raises(AuthError) as exc_info:
            validator.decode(token)
        assert exc_info.value.status_code == 401
        assert "audience" in exc_info.value.detail.lower()

    def test_decode_wrong_issuer(self, rsa_keypair, private_pem):
        validator = self._make_validator(rsa_keypair, domain="other.auth0.com")
        token = _make_token(private_pem, iss="https://test.auth0.com/")

        with pytest.raises(AuthError) as exc_info:
            validator.decode(token)
        assert exc_info.value.status_code == 401
        assert "issuer" in exc_info.value.detail.lower()

    def test_decode_invalid_signature(self, rsa_keypair, private_pem):
        other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        other_pem = other_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        validator = self._make_validator(rsa_keypair)
        token = _make_token(other_pem)

        with pytest.raises(AuthError) as exc_info:
            validator.decode(token)
        assert exc_info.value.status_code == 401

    def test_decode_malformed_token(self, rsa_keypair):
        validator = self._make_validator(rsa_keypair)

        with pytest.raises(AuthError) as exc_info:
            validator.decode("not.a.jwt")
        assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# require_roles tests
# ---------------------------------------------------------------------------


class TestRequireRoles:
    def test_matching_role_allowed(self):
        check = require_roles("Employee")
        payload = TokenPayload(sub="u1", roles=["Employee"])
        result = check(payload)
        assert result is payload

    def test_missing_role_rejected(self):
        check = require_roles("Room Manager")
        payload = TokenPayload(sub="u1", roles=["Employee"])
        with pytest.raises(AuthError) as exc_info:
            check(payload)
        assert exc_info.value.status_code == 403

    def test_admin_bypasses_all(self):
        check = require_roles("Room Manager")
        payload = TokenPayload(sub="u1", roles=["Administrator"])
        result = check(payload)
        assert result is payload

    def test_multiple_allowed_roles(self):
        check = require_roles("Room Manager", "Administrator")
        payload = TokenPayload(sub="u1", roles=["Room Manager"])
        result = check(payload)
        assert result is payload

    def test_no_roles_rejected(self):
        check = require_roles("Employee")
        payload = TokenPayload(sub="u1", roles=[])
        with pytest.raises(AuthError) as exc_info:
            check(payload)
        assert exc_info.value.status_code == 403
