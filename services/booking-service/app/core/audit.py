"""Helper để ghi audit log từ bất kỳ router nào.

Dùng write_audit() ngay trước db.commit() để entry và data chính cùng transaction.
"""

from __future__ import annotations

from contextvars import ContextVar

from common.request_id import request_id_ctx
from sqlalchemy.orm import Session

from app.repositories.audit_log_repository import AuditLogRepository

# Set bởi middleware trong main.py; đọc tự động trong write_audit().
client_ip_ctx: ContextVar[str | None] = ContextVar("client_ip_ctx", default=None)

_ROLE_MAP = {
    "Administrator": "ADMINISTRATOR",
    "Room Manager": "ROOM_MANAGER",
    "Employee": "EMPLOYEE",
}


def _actor_role(roles: list[str]) -> str:
    for r in roles:
        if r in _ROLE_MAP:
            return _ROLE_MAP[r]
    return roles[0].upper().replace(" ", "_") if roles else "EMPLOYEE"


def write_audit(
    db: Session,
    actor_id: str,
    actor_roles: list[str],
    action_type: str,
    *,
    actor_name: str | None = None,
    target_id: str | int | None = None,
    target_name: str | None = None,
    details: str | None = None,
    result: str | None = "SUCCESS",
) -> None:
    """Thêm 1 AuditLog entry vào session (chưa commit)."""
    rid = request_id_ctx.get("-")
    ip = client_ip_ctx.get(None)
    AuditLogRepository(db).create(
        actor_id=actor_id,
        actor_name=actor_name or actor_id,
        actor_role=_actor_role(actor_roles),
        action_type=action_type,
        target_id=str(target_id) if target_id is not None else None,
        target_name=target_name,
        details=details,
        request_id=rid if rid != "-" else None,
        ip_address=ip,
        result=result,
    )
