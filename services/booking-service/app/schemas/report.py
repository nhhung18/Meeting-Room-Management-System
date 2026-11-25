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


class MonthlyStatItem(BaseModel):
    month: str  # YYYY-MM
    total: int
    checked_in: int
    cancelled: int


class RoomUtilisationItem(BaseModel):
    room_id: int
    room_name: str
    bookings: int  # chỉ tính booking chưa hủy
    hours_booked: float
    utilisation_rate: float  # % = hours_booked / giờ khả dụng trong kỳ, tối đa 100


class ReportStatsResponse(BaseModel):
    total: int
    confirmed: int
    checked_in: int
    cancelled: int  # tổng hủy = hủy tay + hủy tự động
    auto_cancelled: int  # no-show: hệ thống tự hủy vì không check-in (FR-07)
    on_time_rate: float  # % bookings that were checked in (of non-cancelled)
    cancel_rate: float  # % bookings that were cancelled
    top_rooms: list[RoomStatItem]
    daily_stats: list[DailyStatItem]
    monthly_stats: list[MonthlyStatItem]
    room_utilisation: list[RoomUtilisationItem]
    peak_hours: list[PeakHourItem]
