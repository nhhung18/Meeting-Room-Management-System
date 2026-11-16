"""Pydantic DTOs cho equipment endpoints."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EquipmentRoomInfo(BaseModel):
    room_id: int
    room_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class EquipmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=100)
    status: str = Field(default="FUNCTIONAL")
    serial_number: str | None = Field(None, max_length=255)
    notes: str | None = None
    room_ids: list[int] = Field(default_factory=list)


class EquipmentUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    category: str | None = Field(None, min_length=1, max_length=100)
    status: str | None = None
    serial_number: str | None = None
    notes: str | None = None
    room_ids: list[int] | None = None


class EquipmentResponse(BaseModel):
    id: int
    name: str
    category: str
    status: str
    serial_number: str | None
    notes: str | None
    rooms: list[EquipmentRoomInfo]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EquipmentListResponse(BaseModel):
    items: list[EquipmentResponse]
    total: int
