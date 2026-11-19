"""Pydantic DTOs cho system policies endpoints."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class PolicyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    value: Any
    description: str | None = None
    updated_by: str | None = None
    updated_at: datetime


class PolicyListResponse(BaseModel):
    items: list[PolicyResponse]


class PolicyUpdate(BaseModel):
    value: Any


class PolicyBulkConfigResponse(BaseModel):
    """Flat config object cho frontend — mirror BookingPolicyConfig ở frontend."""

    max_advance_days: int
    max_duration_minutes: int
    min_duration_minutes: int
    enable_auto_release_no_show: bool
    auto_release_grace_minutes: int
    buffer_minutes_between_meetings: int
    min_cancel_notice_minutes: int
    check_in_window_minutes: int
    updated_at: datetime
    updated_by: str | None = None


class PolicyBulkConfigUpdate(BaseModel):
    """Partial update — tất cả fields đều optional."""

    max_advance_days: int | None = None
    max_duration_minutes: int | None = None
    min_duration_minutes: int | None = None
    enable_auto_release_no_show: bool | None = None
    auto_release_grace_minutes: int | None = None
    buffer_minutes_between_meetings: int | None = None
    min_cancel_notice_minutes: int | None = None
    check_in_window_minutes: int | None = None
