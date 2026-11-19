"""Pydantic DTOs cho report/stats domain."""

from pydantic import BaseModel


class RoomStatItem(BaseModel):
    room_id: int
    room_name: str
    total: int


class DailyStatItem(BaseModel):
    date: str  # YYYY-MM-DD
    total: int
    checked_in: int
    cancelled: int


class PeakHourItem(BaseModel):
    hour: int  # 0-23
    total: int


class ReportStatsResponse(BaseModel):
    total: int
    confirmed: int
    checked_in: int
    cancelled: int
    on_time_rate: float  # % bookings that were checked in (of non-cancelled)
    cancel_rate: float  # % bookings that were cancelled
    top_rooms: list[RoomStatItem]
    daily_stats: list[DailyStatItem]
    peak_hours: list[PeakHourItem]
