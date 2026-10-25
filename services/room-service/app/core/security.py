"""Auth dependencies cho room-service (tương đương @PreAuthorize trong Spring Security).

Tạo JWTValidator singleton từ config. Cung cấp current_user và require_room_manager
làm FastAPI Depends() cho từng endpoint.
"""

from __future__ import annotations

import logging
from functools import lru_cache

from common.auth import AuthError, JWTValidator, TokenPayload, require_roles
from fastapi import Depends, Header, HTTPException

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache
def get_jwt_validator() -> JWTValidator | None:
    """Singleton — None nếu AUTH0_DOMAIN chưa set (auth disabled)."""
    settings = get_settings()
    if not settings.auth0_domain or not settings.auth0_audience:
        logger.warning("AUTH0_DOMAIN/AUTH0_AUDIENCE not set — auth disabled")
        return None
    return JWTValidator(settings.auth0_domain, settings.auth0_audience)


def current_user(
    authorization: str | None = Header(None),
    validator: JWTValidator | None = Depends(get_jwt_validator),
) -> TokenPayload:
    """Dependency: decode JWT và trả về TokenPayload. 401 nếu invalid."""
    if validator is None:
        return TokenPayload(sub="anonymous", roles=["Administrator"])

    if not authorization:
        raise HTTPException(401, detail="Missing Authorization header")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(401, detail="Authorization must be 'Bearer <token>'")

    try:
        return validator.decode(parts[1])
    except AuthError as e:
        raise HTTPException(e.status_code, detail=e.detail) from None


_require_room_manager_check = require_roles("Room Manager", "Administrator")
_require_admin_check = require_roles("Administrator")


def require_room_manager(
    user: TokenPayload = Depends(current_user),
) -> TokenPayload:
    """Dependency: Room Manager hoặc Administrator."""
    try:
        return _require_room_manager_check(user)
    except AuthError as e:
        raise HTTPException(e.status_code, detail=e.detail) from None


def require_admin(
    user: TokenPayload = Depends(current_user),
) -> TokenPayload:
    """Dependency: chỉ Administrator."""
    try:
        return _require_admin_check(user)
    except AuthError as e:
        raise HTTPException(e.status_code, detail=e.detail) from None
