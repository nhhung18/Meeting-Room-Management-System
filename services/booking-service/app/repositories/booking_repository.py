"""BookingRepository — data-access layer cho bảng bookings và booking_attendees.

Pattern: flush() trong repo, commit() trong router.
Mọi read đều lọc deleted_at IS NULL (soft delete).
"""

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.booking import Booking, BookingStatus


class BookingRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def create(self, booking: Booking) -> Booking:
        self._db.add(booking)
        self._db.flush()
        return booking

    def get_by_id(self, booking_id: int) -> Booking | None:
        stmt = (
            select(Booking)
            .where(Booking.id == booking_id, Booking.deleted_at.is_(None))
            .options(selectinload(Booking.attendees))
        )
        return self._db.execute(stmt).scalar_one_or_none()

    def list_by_user(
        self,
        user_id: str,
        *,
        status: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Booking], int]:
        base = select(Booking).where(
            Booking.user_id == user_id,
            Booking.deleted_at.is_(None),
        )
        if status is not None:
            base = base.where(Booking.status == status)

        items_stmt = base.order_by(Booking.start_at.desc()).limit(limit).offset(offset)
        count_stmt = select(func.count()).select_from(base.subquery())

        items = self._db.execute(items_stmt).scalars().all()
        total = self._db.execute(count_stmt).scalar_one()
        return list(items), total

    def list_by_room(
        self,
        room_id: int,
        *,
        status: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Booking], int]:
        base = select(Booking).where(
            Booking.room_id == room_id,
            Booking.deleted_at.is_(None),
        )
        if status is not None:
            base = base.where(Booking.status == status)

        items_stmt = base.order_by(Booking.start_at.desc()).limit(limit).offset(offset)
        count_stmt = select(func.count()).select_from(base.subquery())

        items = self._db.execute(items_stmt).scalars().all()
        total = self._db.execute(count_stmt).scalar_one()
        return list(items), total

    def has_overlap(
        self,
        room_id: int,
        start_at: datetime,
        end_at: datetime,
        *,
        exclude_id: int | None = None,
    ) -> bool:
        # Half-open interval [start, end): start_at < end AND end_at > start
        stmt = select(func.count()).where(
            Booking.room_id == room_id,
            Booking.start_at < end_at,
            Booking.end_at > start_at,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
            Booking.deleted_at.is_(None),
        )
        if exclude_id is not None:
            stmt = stmt.where(Booking.id != exclude_id)

        count = self._db.execute(stmt).scalar_one()
        return count > 0

    def find_overdue_confirmed(self, cutoff: datetime) -> list[Booking]:
        """Trả về các booking CONFIRMED mà start_at + 15min < cutoff (quá hạn check-in)."""
        from datetime import timedelta

        window = timedelta(minutes=15)
        stmt = (
            select(Booking)
            .where(
                Booking.status == BookingStatus.CONFIRMED,
                Booking.start_at + window < cutoff,
                Booking.deleted_at.is_(None),
            )
            .options(selectinload(Booking.attendees))
        )
        return list(self._db.execute(stmt).scalars().all())

    def update(self, booking: Booking) -> Booking:
        booking.updated_at = datetime.now(UTC)
        self._db.flush()
        return booking
