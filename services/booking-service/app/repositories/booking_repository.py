"""BookingRepository — data-access layer cho bảng bookings và booking_attendees.

Pattern: flush() trong repo, commit() trong router.
Mọi read đều lọc deleted_at IS NULL (soft delete).
"""

from datetime import UTC, datetime

from sqlalchemy import extract, func, select
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

    def get_report_summary(
        self,
        *,
        period_start: datetime | None = None,
        period_end: datetime | None = None,
        top_n: int = 5,
    ) -> dict:
        """Trả về dict với các stats cho ReportSummaryResponse."""
        base_filter = [Booking.deleted_at.is_(None)]
        if period_start:
            base_filter.append(Booking.start_at >= period_start)
        if period_end:
            base_filter.append(Booking.start_at < period_end)

        # Counts theo status
        counts_stmt = select(
            Booking.status,
            func.count().label("cnt"),
        ).where(*base_filter).group_by(Booking.status)
        rows = self._db.execute(counts_stmt).all()
        counts_by_status = {row.status: row.cnt for row in rows}

        # Most booked rooms
        room_stmt = (
            select(Booking.room_id, func.count().label("cnt"))
            .where(*base_filter, Booking.status != BookingStatus.CANCELLED)
            .group_by(Booking.room_id)
            .order_by(func.count().desc())
            .limit(top_n)
        )
        most_booked = self._db.execute(room_stmt).all()

        # Busiest hours (extract hour from start_at in UTC)
        hour_stmt = (
            select(
                extract("hour", Booking.start_at).label("hour"),
                func.count().label("cnt"),
            )
            .where(*base_filter, Booking.status != BookingStatus.CANCELLED)
            .group_by(extract("hour", Booking.start_at))
            .order_by(func.count().desc())
            .limit(10)
        )
        busiest_hours = self._db.execute(hour_stmt).all()

        return {
            "counts_by_status": counts_by_status,
            "most_booked": [(row.room_id, row.cnt) for row in most_booked],
            "busiest_hours": [(int(row.hour), row.cnt) for row in busiest_hours],
        }

    def update(self, booking: Booking) -> Booking:
        booking.updated_at = datetime.now(UTC)
        self._db.flush()
        return booking
