"""Bookings REST API router (≈ Spring @RestController).

Thin HTTP adapter: maps HTTP ↔ BookingService, enforces RBAC, and commits
the session on success. Never contains business logic.

Exception → HTTP mapping:
  NotFoundError        → 404
  RoomNotAvailableError → 409
  OverlapError         → 409
  InvalidStateError    → 409
  CapacityExceededError → 422
  PastBookingError     → 422
  IntegrityError       → 409  (EXCLUDE constraint race between instances)
"""

import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import TokenPayload, current_user, require_admin
from app.db.session import get_db
from app.models.outbox_event import OutboxEvent
from app.repositories.booking_repository import BookingRepository
from app.repositories.room_snapshot_repository import RoomSnapshotRepository
from app.schemas.booking import (
    BookingCreate,
    BookingListResponse,
    BookingResponse,
    BookingUpdate,
)
from app.services.booking_service import BookingService
from app.services.room_snapshot_sync import RoomSnapshotSync

router = APIRouter(tags=["bookings"])


# ---------------------------------------------------------------------------
# Dependency helpers
# ---------------------------------------------------------------------------


def _get_booking_service(db: Session = Depends(get_db)) -> BookingService:
    return BookingService(BookingRepository(db), RoomSnapshotRepository(db))


def _get_sync_service(db: Session = Depends(get_db)) -> RoomSnapshotSync:
    return RoomSnapshotSync(RoomSnapshotRepository(db), get_settings().room_service_url)


# ---------------------------------------------------------------------------
# Exception mapping
# ---------------------------------------------------------------------------


def _domain_to_http(exc: BookingService.DomainError) -> HTTPException:
    if isinstance(exc, BookingService.NotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, (BookingService.RoomNotAvailableError, BookingService.OverlapError,
                        BookingService.InvalidStateError)):
        return HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, (BookingService.CapacityExceededError, BookingService.PastBookingError)):
        return HTTPException(status_code=422, detail=str(exc))
    if isinstance(exc, BookingService.CheckInWindowError):
        return HTTPException(status_code=400, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# RBAC helper
# ---------------------------------------------------------------------------


def _check_ownership(booking: BookingResponse, user: TokenPayload) -> None:
    """Raise 403 if user is not the owner and not an admin."""
    if "Administrator" in user.roles:
        return
    if booking.user_id == user.sub:
        return
    raise HTTPException(status_code=403, detail="Access forbidden")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    body: BookingCreate,
    db: Session = Depends(get_db),
    user: TokenPayload = Depends(current_user),
    service: BookingService = Depends(_get_booking_service),
) -> BookingResponse:
    try:
        result = service.create_booking(body, user_id=user.sub)
        db.add(OutboxEvent(
            event_type="booking.created",
            payload=json.dumps({
                "booking_id": result.id,
                "room_id": result.room_id,
                "user_id": result.user_id,
                "start_at": result.start_at.isoformat(),
                "end_at": result.end_at.isoformat(),
                "attendees": [
                    {"email": a.attendee_email, "name": a.name} for a in result.attendees
                ],
            }),
        ))
        db.commit()
        return result
    except BookingService.DomainError as exc:
        raise _domain_to_http(exc) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Booking conflict (constraint violation)"
        ) from exc


@router.get("/", response_model=BookingListResponse)
def list_bookings(
    room_id: int | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: TokenPayload = Depends(current_user),
    service: BookingService = Depends(_get_booking_service),
) -> BookingListResponse:
    # Employees always see only their own bookings
    if "Administrator" in user.roles or "Room Manager" in user.roles:
        user_id_filter = None
    else:
        user_id_filter = user.sub

    return service.list_bookings(
        user_id=user_id_filter,
        room_id=room_id,
        status=status_filter,
        limit=limit,
        offset=offset,
    )


@router.get("/{booking_id}", response_model=BookingResponse)
def get_booking(
    booking_id: int,
    user: TokenPayload = Depends(current_user),
    service: BookingService = Depends(_get_booking_service),
) -> BookingResponse:
    try:
        booking = service.get_booking(booking_id)
    except BookingService.DomainError as exc:
        raise _domain_to_http(exc) from exc
    _check_ownership(booking, user)
    return booking


@router.patch("/{booking_id}", response_model=BookingResponse)
def update_booking(
    booking_id: int,
    body: BookingUpdate,
    db: Session = Depends(get_db),
    user: TokenPayload = Depends(current_user),
    service: BookingService = Depends(_get_booking_service),
) -> BookingResponse:
    # Check ownership before attempting update
    try:
        existing = service.get_booking(booking_id)
    except BookingService.DomainError as exc:
        raise _domain_to_http(exc) from exc
    _check_ownership(existing, user)

    try:
        result = service.update_booking(booking_id, body, user_id=user.sub)
        db.commit()
        return result
    except BookingService.DomainError as exc:
        raise _domain_to_http(exc) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Booking conflict (constraint violation)"
        ) from exc


@router.post("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    user: TokenPayload = Depends(current_user),
    service: BookingService = Depends(_get_booking_service),
) -> BookingResponse:
    # Check ownership before cancelling
    try:
        existing = service.get_booking(booking_id)
    except BookingService.DomainError as exc:
        raise _domain_to_http(exc) from exc
    _check_ownership(existing, user)

    try:
        result = service.cancel_booking(booking_id)
        db.add(OutboxEvent(
            event_type="booking.cancelled",
            payload=json.dumps({
                "booking_id": result.id,
                "room_id": result.room_id,
                "user_id": result.user_id,
            }),
        ))
        db.commit()
        return result
    except BookingService.DomainError as exc:
        raise _domain_to_http(exc) from exc


@router.post("/{booking_id}/check-in", response_model=BookingResponse)
def check_in_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    user: TokenPayload = Depends(current_user),
    service: BookingService = Depends(_get_booking_service),
) -> BookingResponse:
    try:
        existing = service.get_booking(booking_id)
    except BookingService.DomainError as exc:
        raise _domain_to_http(exc) from exc
    _check_ownership(existing, user)

    try:
        result = service.check_in_booking(booking_id)
        db.add(OutboxEvent(
            event_type="booking.checked_in",
            payload=json.dumps({
                "booking_id": result.id,
                "room_id": result.room_id,
                "user_id": result.user_id,
                "checked_in_at": result.checked_in_at.isoformat() if result.checked_in_at else None,
            }),
        ))
        db.commit()
        return result
    except BookingService.DomainError as exc:
        raise _domain_to_http(exc) from exc


@router.post("/admin/sync-rooms")
def sync_rooms(
    db: Session = Depends(get_db),
    _user: TokenPayload = Depends(require_admin),
    sync_service: RoomSnapshotSync = Depends(_get_sync_service),
) -> dict:
    count = sync_service.sync_from_room_service()
    db.commit()
    return {"synced": count}
