"""Audit Log API — Admin only endpoints để xem nhật ký kiểm toán."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import TokenPayload, require_admin
from app.db.session import get_db
from app.repositories.audit_log_repository import AuditLogRepository
from app.schemas.audit_log import AuditLogListResponse, AuditLogResponse

router = APIRouter(tags=["audit-logs"])


def _get_audit_repo(db: Session = Depends(get_db)) -> AuditLogRepository:
    return AuditLogRepository(db)


@router.get("/", response_model=AuditLogListResponse)
def list_audit_logs(
    resource_id: int | None = Query(None, description="Lọc theo booking ID"),
    actor_id: str | None = Query(None, description="Lọc theo user ID"),
    action: str | None = Query(None, description="Lọc theo action (CREATE/UPDATE/CANCEL/CHECK_IN)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _user: TokenPayload = Depends(require_admin),
    repo: AuditLogRepository = Depends(_get_audit_repo),
) -> AuditLogListResponse:
    items, total = repo.list_logs(
        resource_id=resource_id,
        actor_id=actor_id,
        action=action,
        limit=limit,
        offset=offset,
    )
    return AuditLogListResponse(
        items=[AuditLogResponse.model_validate(log) for log in items],
        total=total,
        limit=limit,
        offset=offset,
    )
