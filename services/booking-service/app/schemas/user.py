"""Pydantic DTOs cho user management endpoints."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

UserRole = Literal["EMPLOYEE", "ROOM_MANAGER", "ADMINISTRATOR"]
UserStatus = Literal["ACTIVE", "SUSPENDED"]


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    role: str
    status: str
    department: str | None = None
    phone: str | None = None
    avatar: str | None = None
    created_at: datetime
    updated_at: datetime


class UserListResponse(BaseModel):
    items: list[UserProfileResponse]
    total: int


class UserCreate(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole = "EMPLOYEE"
    status: UserStatus = "ACTIVE"
    department: str | None = None
    phone: str | None = None
    avatar: str | None = None


class UserUpdate(BaseModel):
    name: str | None = None
    role: UserRole | None = None
    status: UserStatus | None = None
    department: str | None = None
    phone: str | None = None
    avatar: str | None = None
