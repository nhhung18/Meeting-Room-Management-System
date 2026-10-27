"""Security module for booking-service: TokenPayload, current_user, require_admin.

Anonymous mode: when AUTH0_DOMAIN is not set (dev/test), current_user returns a
synthetic Administrator payload so all endpoints work without Auth0.
Full JWT validation is added in task #12 when Auth0 is configured — no router
changes needed at that point.
"""

import os

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

_bearer = HTTPBearer(auto_error=False)


class TokenPayload(BaseModel):
    """Decoded JWT claims (≈ Spring Security's Authentication principal)."""

    sub: str
    roles: list[str] = Field(default_factory=list)
    email: str | None = None


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> TokenPayload:
    """FastAPI dependency that returns the current authenticated user.

    Dev mode (AUTH0_DOMAIN not set): returns anonymous admin so all endpoints
    are reachable without a real token.
    Auth mode: validates the Bearer token (full implementation in task #12).
    """
    if not os.environ.get("AUTH0_DOMAIN"):
        return TokenPayload(sub="anonymous", roles=["Administrator"])

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Placeholder — real JWT validation is wired in task #12.
    # For now, treat any Bearer token as an anonymous admin.
    return TokenPayload(sub="anonymous", roles=["Administrator"])


def require_admin(user: TokenPayload = Depends(current_user)) -> TokenPayload:
    """Dependency that ensures the caller has the Administrator role."""
    if "Administrator" not in user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator role required",
        )
    return user
