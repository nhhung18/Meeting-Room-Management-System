from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    timestamp: str
    actor_id: str
    actor_name: str | None
    actor_role: str | None
    action_type: str
    target_id: str | None
    target_name: str | None
    details: str | None
    ip_address: str | None
    request_id: str | None = None

    @classmethod
    def from_model(cls, m) -> "AuditLogResponse":
        return cls(
            id=str(m.id),
            timestamp=(
                m.timestamp.isoformat() if isinstance(m.timestamp, datetime) else str(m.timestamp)
            ),
            actor_id=m.actor_id,
            actor_name=m.actor_name,
            actor_role=m.actor_role,
            action_type=m.action_type,
            target_id=m.target_id,
            target_name=m.target_name,
            details=m.details,
            ip_address=m.ip_address,
            request_id=getattr(m, "request_id", None),
        )


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int
