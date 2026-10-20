"""Pydantic DTOs cho room endpoints (tương đương @RequestBody/@ResponseBody trong Spring).

RoomCreate: POST body.
RoomUpdate: PATCH body — tất cả fields optional.
  exclude_unset phân biệt "không gửi" vs "gửi null" khi service áp dụng update.
RoomResponse: single room trả về client (không expose deleted_at).
RoomListResponse: paginated list.
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.room import RoomStatus


class RoomCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    capacity: int = Field(..., gt=0)
    status: RoomStatus | None = None
    equipment: list[str] = Field(default_factory=list)
    owner_id: str | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped

    @field_validator("equipment")
    @classmethod
    def deduplicate_equipment(cls, v: list[str]) -> list[str]:
        return list(dict.fromkeys(v))  # preserves order, removes duplicates


class RoomUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    capacity: int | None = Field(None, gt=0)
    status: RoomStatus | None = None
    equipment: list[str] | None = None
    owner_id: str | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        stripped = v.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped

    @field_validator("equipment")
    @classmethod
    def deduplicate_equipment(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        return list(dict.fromkeys(v))


class RoomResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    capacity: int
    status: str
    equipment: list[str]
    owner_id: str | None
    created_at: datetime
    updated_at: datetime


class RoomListResponse(BaseModel):
    items: list[RoomResponse]
    total: int
    limit: int
    offset: int
