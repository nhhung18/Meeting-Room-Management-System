"""System policies API — Admin điều chỉnh tham số vận hành runtime (FR-05-4)."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import TokenPayload, require_admin
from app.db.session import get_db
from app.repositories.system_policy_repository import SystemPolicyRepository
from app.schemas.policy import PolicyListResponse, PolicyResponse, PolicyUpdate
from app.services.policy_service import get_policy_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/policies", tags=["policies"])

# Validation rules cho từng policy key
_VALIDATORS = {
    "check_in_window_minutes": lambda v: isinstance(v, int) and 1 <= v <= 120,
}


def _validate(key: str, value) -> None:
    validator = _VALIDATORS.get(key)
    if validator is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown policy key: {key}",
        )
    if not validator(value):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid value for {key}",
        )


@router.get("/", response_model=PolicyListResponse)
def list_policies(
    _user: TokenPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    repo = SystemPolicyRepository(db)
    items = [PolicyResponse.model_validate(p) for p in repo.list_all()]
    return PolicyListResponse(items=items)


@router.get("/{key}", response_model=PolicyResponse)
def get_policy(
    key: str,
    _user: TokenPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    policy = SystemPolicyRepository(db).get(key)
    if policy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found")
    return PolicyResponse.model_validate(policy)


@router.patch("/{key}", response_model=PolicyResponse)
def update_policy(
    key: str,
    body: PolicyUpdate,
    user: TokenPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _validate(key, body.value)
    repo = SystemPolicyRepository(db)
    policy = repo.upsert(key, body.value, updated_by=user.sub)
    db.commit()

    # Invalidate cache để lần đọc tiếp theo nhận giá trị mới ngay
    get_policy_service().invalidate(key)
    logger.info(
        "policy updated",
        extra={"fields": {"key": key, "updated_by": user.sub}},
    )
    return PolicyResponse.model_validate(policy)
