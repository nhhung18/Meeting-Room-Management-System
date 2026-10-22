"""Pydantic v2 DTOs cho booking domain."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class AttendeeInput(BaseModel):
    email: EmailStr
    name: Annotated[str, Field(min_length=1)]

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped


class BookingCreate(BaseModel):
    room_id: int = Field(gt=0)
    start_at: datetime
    end_at: datetime
    num_attendees: int = Field(gt=0)
    attendees: list[AttendeeInput] = Field(default_factory=list)

    @field_validator("start_at", "end_at", mode="after")
    @classmethod
    def ensure_tz_aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("datetime must be timezone-aware")
        return v

    @model_validator(mode="after")
    def end_after_start(self) -> "BookingCreate":
        if self.start_at is not None and self.end_at is not None:
            if self.end_at <= self.start_at:
                raise ValueError("end_at must be after start_at")
        return self


class BookingUpdate(BaseModel):
    room_id: int | None = Field(default=None, gt=0)
    start_at: datetime | None = None
    end_at: datetime | None = None
    num_attendees: int | None = Field(default=None, gt=0)
    attendees: list[AttendeeInput] | None = None

    @field_validator("start_at", "end_at", mode="after")
    @classmethod
    def ensure_tz_aware(cls, v: datetime | None) -> datetime | None:
        if v is not None and v.tzinfo is None:
            raise ValueError("datetime must be timezone-aware")
        return v

    @model_validator(mode="after")
    def end_after_start(self) -> "BookingUpdate":
        if self.start_at is not None and self.end_at is not None:
            if self.end_at <= self.start_at:
                raise ValueError("end_at must be after start_at")
        return self


class AttendeeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    attendee_email: str
    name: str


class BookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    room_id: int
    user_id: str
    start_at: datetime
    end_at: datetime
    num_attendees: int
    status: str
    checked_in_at: datetime | None = None
    auto_cancelled_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    room_name: str | None = None
    attendees: list[AttendeeResponse] = Field(default_factory=list)


class BookingListResponse(BaseModel):
    items: list[BookingResponse]
    total: int
    limit: int
    offset: int
