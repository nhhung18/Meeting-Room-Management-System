"""System policies API — Admin điều chỉnh tham số vận hành runtime (FR-05-4)."""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.core.security import TokenPayload, current_user, require_admin
from app.db.session import get_db
from app.repositories.system_policy_repository import SystemPolicyRepository
from app.schemas.policy import (
    PolicyBulkConfigResponse,
    PolicyBulkConfigUpdate,
    PolicyListResponse,
    PolicyResponse,
    PolicyUpdate,
)
from app.services.policy_service import get_policy_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/policies", tags=["policies"])

# Defaults cho từng key (mirror với policy_service._DEFAULTS + thêm các key mới)
_DEFAULTS: dict[str, object] = {
    "check_in_window_minutes": 15,
    "max_advance_days": 14,
    "max_duration_minutes": 180,
    "min_duration_minutes": 15,
    "enable_auto_release_no_show": True,
    "auto_release_grace_minutes": 15,
    "buffer_minutes_between_meetings": 0,
    "min_cancel_notice_minutes": 30,
}

_VALIDATORS = {
    "check_in_window_minutes": lambda v: isinstance(v, int) and 1 <= v <= 120,
    "max_advance_days": lambda v: isinstance(v, int) and 1 <= v <= 365,
    "max_duration_minutes": lambda v: isinstance(v, int) and 15 <= v <= 1440,
    "min_duration_minutes": lambda v: isinstance(v, int) and 5 <= v <= 120,
    "enable_auto_release_no_show": lambda v: isinstance(v, bool),
    "auto_release_grace_minutes": lambda v: isinstance(v, int) and 0 <= v <= 120,
    "buffer_minutes_between_meetings": lambda v: isinstance(v, int) and 0 <= v <= 60,
    "min_cancel_notice_minutes": lambda v: isinstance(v, int) and 0 <= v <= 1440,
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


@router.get("/config", response_model=PolicyBulkConfigResponse)
def get_config(
    _user: TokenPayload = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Trả về toàn bộ policy config dưới dạng flat object — dùng bởi frontend."""
    repo = SystemPolicyRepository(db)
    all_policies = {p.key: p for p in repo.list_all()}

    def _get(key: str):
        return all_policies[key].value if key in all_policies else _DEFAULTS[key]

    # Tìm updated_at / updated_by mới nhất trong toàn bộ policies
    latest = max(
        (p for p in all_policies.values()),
        key=lambda p: p.updated_at,
        default=None,
    )

    return PolicyBulkConfigResponse(
        max_advance_days=int(_get("max_advance_days")),
        max_duration_minutes=int(_get("max_duration_minutes")),
        min_duration_minutes=int(_get("min_duration_minutes")),
        enable_auto_release_no_show=bool(_get("enable_auto_release_no_show")),
        auto_release_grace_minutes=int(_get("auto_release_grace_minutes")),
        buffer_minutes_between_meetings=int(_get("buffer_minutes_between_meetings")),
        min_cancel_notice_minutes=int(_get("min_cancel_notice_minutes")),
        check_in_window_minutes=int(_get("check_in_window_minutes")),
        updated_at=latest.updated_at if latest else datetime.now(UTC),
        updated_by=latest.updated_by if latest else None,
    )


@router.patch("/config", response_model=PolicyBulkConfigResponse)
def update_config(
    body: PolicyBulkConfigUpdate,
    user: TokenPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Cập nhật một hoặc nhiều policy key cùng lúc — dùng bởi frontend."""
    repo = SystemPolicyRepository(db)
    updates = body.model_dump(exclude_none=True)

    for key, value in updates.items():
        _validate(key, value)
        repo.upsert(key, value, updated_by=user.sub)
        get_policy_service().invalidate(key)

    write_audit(
        db,
        user.sub,
        user.roles,
        "POLICY_CONFIG_UPDATED",
        actor_name=user.email or user.sub,
        details=f"Cập nhật {len(updates)} chính sách: {', '.join(updates.keys())}",
    )
    db.commit()
    logger.info(
        "policies bulk updated",
        extra={"fields": {"keys": list(updates.keys()), "updated_by": user.sub}},
    )

    return get_config(_user=user, db=db)


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
    write_audit(
        db,
        user.sub,
        user.roles,
        "POLICY_CONFIG_UPDATED",
        actor_name=user.email or user.sub,
        target_name=key,
        details=f"{key} = {body.value}",
    )
    db.commit()
    get_policy_service().invalidate(key)
    logger.info(
        "policy updated",
        extra={"fields": {"key": key, "updated_by": user.sub}},
    )
    return PolicyResponse.model_validate(policy)
