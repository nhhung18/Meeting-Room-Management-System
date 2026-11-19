"""User Management API — CRUD user_profiles (FR phương án 3: local DB RBAC).

Admin quản lý roles/status. JIT provision khi user đăng nhập.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import TokenPayload, current_user, require_admin
from app.db.session import get_db
from app.repositories.user_profile_repository import UserProfileRepository
from app.schemas.user import (
    UserCreate,
    UserListResponse,
    UserProfileResponse,
    UserUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=UserListResponse)
def list_users(
    q: str | None = Query(None),
    role: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    department: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _user: TokenPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    repo = UserProfileRepository(db)
    items, total = repo.list_all(
        q=q, role=role, status=status_filter, department=department,
        limit=limit, offset=offset,
    )
    return UserListResponse(
        items=[UserProfileResponse.model_validate(u) for u in items],
        total=total,
    )


@router.post("/", response_model=UserProfileResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    _actor: TokenPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    repo = UserProfileRepository(db)
    if repo.get(body.id) or repo.get_by_email(body.email):
        raise HTTPException(status_code=409, detail="User already exists")
    user = repo.upsert(
        body.id, body.email, body.name,
        role=body.role, status=body.status,
        department=body.department, phone=body.phone, avatar=body.avatar,
    )
    db.commit()
    logger.info("user created", extra={"fields": {"user_id": user.id, "email": user.email}})
    return UserProfileResponse.model_validate(user)


@router.get("/me", response_model=UserProfileResponse)
def get_me(
    actor: TokenPayload = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Trả về profile của user hiện tại. JIT create nếu chưa có."""
    repo = UserProfileRepository(db)
    user = repo.get(actor.sub)
    if user is None:
        # JIT provisioning
        user = repo.upsert(
            actor.sub,
            email=actor.email or f"{actor.sub}@unknown.local",
            name=actor.email or actor.sub,
            role=actor.roles[0] if actor.roles else "EMPLOYEE",
        )
        db.commit()
    return UserProfileResponse.model_validate(user)


@router.get("/{user_id}", response_model=UserProfileResponse)
def get_user(
    user_id: str,
    _user: TokenPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = UserProfileRepository(db).get(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return UserProfileResponse.model_validate(user)


@router.patch("/{user_id}", response_model=UserProfileResponse)
def update_user(
    user_id: str,
    body: UserUpdate,
    _actor: TokenPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    repo = UserProfileRepository(db)
    user = repo.get(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    updated = repo.update(user, body.model_dump(exclude_none=True))
    db.commit()
    logger.info("user updated", extra={"fields": {"user_id": user_id}})
    return UserProfileResponse.model_validate(updated)
