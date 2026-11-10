"""Pydantic schemas cho audit log API."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_id: str
    actor_roles: list[str]
    action: str
    resource_type: str
    resource_id: int
    before_snapshot: dict | None = None
    after_snapshot: dict | None = None
    request_id: str | None = None
    created_at: datetime


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int
    limit: int
    offset: int
