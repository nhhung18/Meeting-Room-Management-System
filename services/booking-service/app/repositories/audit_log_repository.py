"""AuditLogRepository — write-only log store.

Chỉ INSERT; không UPDATE/DELETE — audit logs là immutable.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


class AuditLogRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def create(self, log: AuditLog) -> AuditLog:
        self._db.add(log)
        self._db.flush()
        return log

    def list_logs(
        self,
        *,
        resource_id: int | None = None,
        actor_id: str | None = None,
        action: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[AuditLog], int]:
        from sqlalchemy import func

        base = select(AuditLog)
        if resource_id is not None:
            base = base.where(AuditLog.resource_id == resource_id)
        if actor_id is not None:
            base = base.where(AuditLog.actor_id == actor_id)
        if action is not None:
            base = base.where(AuditLog.action == action)

        count_stmt = select(func.count()).select_from(base.subquery())
        total = self._db.scalar(count_stmt) or 0
        items = list(
            self._db.scalars(
                base.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
            ).all()
        )
        return items, total
