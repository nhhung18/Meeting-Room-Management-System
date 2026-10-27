"""Booking ORM models (tương đương @Entity trong JPA).

Map tới bảng `bookings` và `booking_attendees` trong booking_db.
Soft delete qua cột nullable `deleted_at`.
Attendees được load tự động qua selectin loading.
"""

import enum
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class BookingStatus(enum.StrEnum):
    """Ba trạng thái vòng đời của booking.

    StrEnum (Python 3.11+) kế thừa str — Pydantic serialize/deserialize tự nhiên.
    """

    CONFIRMED = "CONFIRMED"
    CHECKED_IN = "CHECKED_IN"
    CANCELLED = "CANCELLED"


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    room_id: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    user_id: Mapped[str] = mapped_column(sa.VARCHAR(255), nullable=False)
    start_at: Mapped[datetime] = mapped_column(sa.TIMESTAMP(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(sa.TIMESTAMP(timezone=True), nullable=False)
    num_attendees: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        sa.VARCHAR(20),
        nullable=False,
        server_default="CONFIRMED",
    )
    checked_in_at: Mapped[datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )
    auto_cancelled_at: Mapped[datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )

    # selectin: load attendees cùng lúc với booking, không cần thêm query riêng.
    attendees: Mapped[list["BookingAttendee"]] = relationship(
        "BookingAttendee",
        back_populates="booking",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Booking id={self.id} room_id={self.room_id} status={self.status}>"


class BookingAttendee(Base):
    __tablename__ = "booking_attendees"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
    )
    attendee_email: Mapped[str] = mapped_column(sa.VARCHAR(255), nullable=False)
    name: Mapped[str] = mapped_column(sa.VARCHAR(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )

    booking: Mapped["Booking"] = relationship("Booking", back_populates="attendees")

    def __repr__(self) -> str:
        return f"<BookingAttendee id={self.id} email={self.attendee_email!r}>"
