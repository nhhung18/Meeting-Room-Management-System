from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


class AuditLogRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        actor_id: str,
        action_type: str,
        *,
        actor_name: str | None = None,
        actor_role: str | None = None,
        target_id: str | None = None,
        target_name: str | None = None,
        details: str | None = None,
        ip_address: str | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            actor_id=actor_id,
            actor_name=actor_name,
            actor_role=actor_role,
            action_type=action_type,
            target_id=target_id,
            target_name=target_name,
            details=details,
            ip_address=ip_address,
        )
        self.db.add(entry)
        return entry

    def list_all(
        self,
        *,
        q: str | None = None,
        action_type: str | None = None,
        actor_id: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[AuditLog], int]:
        stmt = select(AuditLog)
        count_stmt = select(func.count()).select_from(AuditLog)

        if q:
            pattern = f"%{q}%"
            from sqlalchemy import or_
            filter_q = or_(
                AuditLog.actor_name.ilike(pattern),
                AuditLog.target_name.ilike(pattern),
                AuditLog.details.ilike(pattern),
            )
            stmt = stmt.where(filter_q)
            count_stmt = count_stmt.where(filter_q)

        if action_type and action_type != "ALL":
            stmt = stmt.where(AuditLog.action_type == action_type)
            count_stmt = count_stmt.where(AuditLog.action_type == action_type)

        if actor_id and actor_id != "ALL":
            stmt = stmt.where(AuditLog.actor_id == actor_id)
            count_stmt = count_stmt.where(AuditLog.actor_id == actor_id)

        if start_date:
            try:
                start = datetime.fromisoformat(start_date)
                stmt = stmt.where(AuditLog.timestamp >= start)
                count_stmt = count_stmt.where(AuditLog.timestamp >= start)
            except ValueError:
                pass

        if end_date:
            try:
                end = datetime.fromisoformat(f"{end_date}T23:59:59")
                stmt = stmt.where(AuditLog.timestamp <= end)
                count_stmt = count_stmt.where(AuditLog.timestamp <= end)
            except ValueError:
                pass

        total = self.db.execute(count_stmt).scalar_one()
        items = self.db.execute(
            stmt.order_by(AuditLog.timestamp.desc()).limit(limit).offset(offset)
        ).scalars().all()

        return list(items), total
