"""JWT validation và RBAC cho Auth0 (tương đương Spring Security filter chain).

JWTValidator fetch JWKS từ Auth0 một lần khi khởi tạo, decode + verify mỗi request.
require_roles() tạo FastAPI dependency kiểm tra role trong custom claim.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import jwt
from jwt import PyJWKClient

if TYPE_CHECKING:
    from collections.abc import Callable

logger = logging.getLogger(__name__)

ROLES_CLAIM = "https://mrms.api/roles"


class AuthError(Exception):
    """Lỗi authentication/authorization — mang status_code để router map sang HTTP."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


@dataclass
class TokenPayload:
    """Thông tin trích xuất từ JWT sau khi verify thành công."""

    sub: str
    roles: list[str] = field(default_factory=list)
    permissions: list[str] = field(default_factory=list)
    exp: int = 0


class JWTValidator:
    """Verify JWT từ Auth0 bằng RS256 + JWKS.

    Tương đương JwtDecoder trong Spring Security — tự fetch public keys từ Auth0
    và cache (PyJWKClient cache built-in, tự refresh khi key rotate).
    """

    def __init__(self, domain: str, audience: str) -> None:
        self._audience = audience
        self._issuer = f"https://{domain}/"
        jwks_url = f"https://{domain}/.well-known/jwks.json"
        self._jwks_client = PyJWKClient(jwks_url)

    def decode(self, token: str) -> TokenPayload:
        """Decode và verify JWT. Raise AuthError(401) nếu invalid."""
        try:
            signing_key = self._jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=self._audience,
                issuer=self._issuer,
            )
            return TokenPayload(
                sub=payload.get("sub", ""),
                roles=payload.get(ROLES_CLAIM, []),
                permissions=payload.get("permissions", []),
                exp=payload.get("exp", 0),
            )
        except jwt.ExpiredSignatureError:
            raise AuthError(401, "Token has expired") from None
        except jwt.InvalidAudienceError:
            raise AuthError(401, "Invalid audience") from None
        except jwt.InvalidIssuerError:
            raise AuthError(401, "Invalid issuer") from None
        except (jwt.InvalidTokenError, jwt.PyJWKClientError) as e:
            raise AuthError(401, f"Invalid token: {e}") from None


def require_roles(*allowed_roles: str) -> Callable:
    """Factory tạo FastAPI dependency kiểm tra role.

    Administrator luôn được phép (bypass). Trả về TokenPayload nếu ok, raise AuthError(403) nếu không.
    """

    def _check(payload: TokenPayload) -> TokenPayload:
        user_roles = set(payload.roles)
        if "Administrator" in user_roles:
            return payload
        if user_roles & set(allowed_roles):
            return payload
        raise AuthError(403, "Insufficient permissions")

    return _check
