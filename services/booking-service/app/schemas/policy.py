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
