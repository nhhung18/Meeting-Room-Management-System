"""Pydantic schemas for availability search endpoint."""

from pydantic import BaseModel, ConfigDict


class AvailableRoomResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    room_id: int
    name: str
    capacity: int
    floor: str | None
    status: str
    equipment: list[str]


class AvailabilitySearchResponse(BaseModel):
    items: list[AvailableRoomResponse]
    total: int
