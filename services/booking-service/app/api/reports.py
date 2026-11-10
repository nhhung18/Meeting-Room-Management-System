"""Reports API — Admin only endpoints for booking statistics."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import TokenPayload, require_admin
from app.db.session import get_db
from app.repositories.booking_repository import BookingRepository
from app.repositories.room_snapshot_repository import RoomSnapshotRepository
from app.schemas.booking import ReportSummaryResponse
from app.services.booking_service import BookingService

router = APIRouter(tags=["reports"])


def _get_booking_service(db: Session = Depends(get_db)) -> BookingService:
    return BookingService(BookingRepository(db), RoomSnapshotRepository(db))


@router.get("/summary", response_model=ReportSummaryResponse)
def get_report_summary(
    period_start: datetime | None = Query(None, description="Bắt đầu kỳ báo cáo (ISO 8601, có timezone)"),
    period_end: datetime | None = Query(None, description="Kết thúc kỳ báo cáo (ISO 8601, có timezone)"),
    top_n: int = Query(5, ge=1, le=20, description="Số phòng top N trong most_booked_rooms"),
    _user: TokenPayload = Depends(require_admin),
    service: BookingService = Depends(_get_booking_service),
) -> ReportSummaryResponse:
    return service.get_report(
        period_start=period_start,
        period_end=period_end,
        top_n=top_n,
    )
