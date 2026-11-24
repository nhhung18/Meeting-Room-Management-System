"""Report API — aggregate statistics for the admin reports page (FR-07)."""

from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.security import TokenPayload, require_manager_or_admin
from app.db.session import get_db
from app.models.booking import Booking
from app.models.room_snapshot import RoomSnapshot
from app.schemas.report import (
    DailyStatItem,
    PeakHourItem,
    ReportStatsResponse,
    RoomStatItem,
)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/stats", response_model=ReportStatsResponse)
def get_report_stats(
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (inclusive)"),
    db: Session = Depends(get_db),
    _: TokenPayload = Depends(require_manager_or_admin),
) -> ReportStatsResponse:
    start_dt = datetime(start_date.year, start_date.month, start_date.day, tzinfo=UTC)
    end_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59, tzinfo=UTC)

    base_filter = [
        Booking.start_at >= start_dt,
        Booking.start_at <= end_dt,
        Booking.deleted_at.is_(None),
    ]

    # --- Totals by status ---
    status_counts = dict(
        db.execute(
            select(Booking.status, func.count().label("n"))
            .where(*base_filter)
            .group_by(Booking.status)
        ).all()
    )
    total = sum(status_counts.values())
    confirmed = status_counts.get("CONFIRMED", 0)
    checked_in = status_counts.get("CHECKED_IN", 0)
    cancelled = status_counts.get("CANCELLED", 0)

    non_cancelled = total - cancelled
    on_time_rate = round(checked_in / non_cancelled * 100, 1) if non_cancelled > 0 else 0.0
    cancel_rate = round(cancelled / total * 100, 1) if total > 0 else 0.0

    # --- Top rooms (by booking count, top 5) ---
    top_room_rows = db.execute(
        select(Booking.room_id, func.count().label("n"))
        .where(*base_filter)
        .group_by(Booking.room_id)
        .order_by(func.count().desc())
        .limit(5)
    ).all()

    room_ids = [r.room_id for r in top_room_rows]
    snapshots = {
        s.room_id: s.name
        for s in db.execute(select(RoomSnapshot).where(RoomSnapshot.room_id.in_(room_ids)))
        .scalars()
        .all()
    }
    top_rooms = [
        RoomStatItem(
            room_id=r.room_id,
            room_name=snapshots.get(r.room_id, f"Room {r.room_id}"),
            total=r.n,
        )
        for r in top_room_rows
    ]

    # --- Daily breakdown ---
    daily_rows = db.execute(
        select(
            func.date(Booking.start_at).label("day"),
            func.count().label("total"),
            func.sum(case((Booking.status == "CHECKED_IN", 1), else_=0)).label("ci"),
            func.sum(case((Booking.status == "CANCELLED", 1), else_=0)).label("ca"),
        )
        .where(*base_filter)
        .group_by(func.date(Booking.start_at))
        .order_by(func.date(Booking.start_at))
    ).all()

    daily_stats = [
        DailyStatItem(
            date=str(row.day),
            total=row.total,
            checked_in=row.ci or 0,
            cancelled=row.ca or 0,
        )
        for row in daily_rows
    ]

    # --- Peak hours (by start hour, top 24) ---
    peak_rows = db.execute(
        select(
            func.extract("hour", Booking.start_at).label("hr"),
            func.count().label("n"),
        )
        .where(*base_filter)
        .group_by(func.extract("hour", Booking.start_at))
        .order_by(func.extract("hour", Booking.start_at))
    ).all()

    peak_hours = [PeakHourItem(hour=int(row.hr), total=row.n) for row in peak_rows]

    return ReportStatsResponse(
        total=total,
        confirmed=confirmed,
        checked_in=checked_in,
        cancelled=cancelled,
        on_time_rate=on_time_rate,
        cancel_rate=cancel_rate,
        top_rooms=top_rooms,
        daily_stats=daily_stats,
        peak_hours=peak_hours,
    )
