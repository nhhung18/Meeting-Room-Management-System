"""Audit Log API — chỉ Administrator có thể đọc."""

import logging

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.core.security import TokenPayload, current_user, require_admin
from app.db.session import get_db
from app.repositories.audit_log_repository import AuditLogRepository
from app.schemas.audit_log import AuditLogListResponse, AuditLogResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.post("/login-audit", status_code=status.HTTP_204_NO_CONTENT)
def login_audit(
    user: TokenPayload = Depends(current_user),
    db: Session = Depends(get_db),
) -> None:
    """Ghi audit LOGIN_SUCCESS khi user đăng nhập thành công qua Auth0.
    Gọi bởi frontend ngay sau khi isAuthenticated = true.
    """
    write_audit(
        db,
        user.sub,
        user.roles,
        "LOGIN_SUCCESS",
        actor_name=user.email or user.sub,
        details="Đăng nhập thành công",
        result="SUCCESS",
    )
    db.commit()
    logger.info("login audit recorded", extra={"fields": {"user": user.sub}})


@router.get("/", response_model=AuditLogListResponse)
def list_audit_logs(
    q: str | None = Query(None, description="Tìm trong actor_name, target_name, details"),
    action_type: str | None = Query(None),
    actor_id: str | None = Query(None),
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
    end_date: str | None = Query(None, description="YYYY-MM-DD"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _user: TokenPayload = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AuditLogListResponse:
    repo = AuditLogRepository(db)
    items, total = repo.list_all(
        q=q,
        action_type=action_type,
        actor_id=actor_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )
    return AuditLogListResponse(
        items=[AuditLogResponse.from_model(item) for item in items],
        total=total,
    )
