"""BookingService — service layer for all booking operations (≈ Spring @Service).

Enforces all 6 business validations from docs/assumptions.md.
Never calls session.commit() — that is the router's responsibility.
Domain exceptions are inner classes for clean namespacing in the API layer.
"""

from datetime import UTC, datetime

from app.models.booking import Booking, BookingAttendee, BookingStatus
from app.repositories.booking_repository import BookingRepository
from app.repositories.room_snapshot_repository import RoomSnapshotRepository
from app.schemas.booking import (
    AttendeeResponse,
    BookingCreate,
    BookingListResponse,
    BookingResponse,
    BookingUpdate,
)


class BookingService:
    # ------------------------------------------------------------------
    # Domain exceptions — each maps to one HTTP status in the API layer
    # ------------------------------------------------------------------

    class DomainError(Exception):
        pass

    class NotFoundError(DomainError):
        pass

    class RoomNotAvailableError(DomainError):
        pass

    class CapacityExceededError(DomainError):
        pass

    class OverlapError(DomainError):
        pass

    class PastBookingError(DomainError):
        pass

    class InvalidStateError(DomainError):
        pass

    # ------------------------------------------------------------------
    # Constructor
    # ------------------------------------------------------------------

    def __init__(
        self,
        booking_repo: BookingRepository,
        snapshot_repo: RoomSnapshotRepository,
    ) -> None:
        self._booking_repo = booking_repo
        self._snapshot_repo = snapshot_repo

    # ------------------------------------------------------------------
    # Public methods
    # ------------------------------------------------------------------

    def create_booking(self, dto: BookingCreate, user_id: str) -> BookingResponse:
        # 1. Room exists
        snapshot = self._snapshot_repo.get_by_room_id(dto.room_id)
        if snapshot is None:
            raise BookingService.NotFoundError(f"Room {dto.room_id} not found in snapshots")

        # 2. Room must be AVAILABLE
        if snapshot.status != "AVAILABLE":
            raise BookingService.RoomNotAvailableError(
                f"Room {dto.room_id} is not available (status={snapshot.status})"
            )

        # 3. Booking must start in the future (start_at == now is considered past)
        if dto.start_at <= datetime.now(UTC):
            raise BookingService.PastBookingError("Booking start time must be in the future")

        # 4. Capacity check
        if dto.num_attendees > snapshot.capacity:
            raise BookingService.CapacityExceededError(
                f"num_attendees={dto.num_attendees} exceeds room capacity={snapshot.capacity}"
            )

        # 5. Overlap check
        if self._booking_repo.has_overlap(dto.room_id, dto.start_at, dto.end_at):
            raise BookingService.OverlapError(
                f"Room {dto.room_id} already has a booking in that time slot"
            )

        # 6. Build ORM objects and persist
        booking = Booking(
            room_id=dto.room_id,
            user_id=user_id,
            start_at=dto.start_at,
            end_at=dto.end_at,
            num_attendees=dto.num_attendees,
            status=BookingStatus.CONFIRMED,
        )
        booking.attendees = [
            BookingAttendee(attendee_email=a.email, name=a.name) for a in dto.attendees
        ]
        booking = self._booking_repo.create(booking)

        return self._to_response(booking, snapshot.name)

    def get_booking(self, booking_id: int) -> BookingResponse:
        booking = self._booking_repo.get_by_id(booking_id)
        if booking is None:
            raise BookingService.NotFoundError(f"Booking {booking_id} not found")

        snapshot = self._snapshot_repo.get_by_room_id(booking.room_id)
        room_name = snapshot.name if snapshot else None
        return self._to_response(booking, room_name)

    def list_bookings(
        self,
        *,
        user_id: str | None = None,
        room_id: int | None = None,
        status: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> BookingListResponse:
        if user_id is not None:
            items, total = self._booking_repo.list_by_user(
                user_id, status=status, limit=limit, offset=offset
            )
        elif room_id is not None:
            items, total = self._booking_repo.list_by_room(
                room_id, status=status, limit=limit, offset=offset
            )
        else:
            items, total = [], 0

        responses = []
        for booking in items:
            snapshot = self._snapshot_repo.get_by_room_id(booking.room_id)
            room_name = snapshot.name if snapshot else None
            responses.append(self._to_response(booking, room_name))

        return BookingListResponse(items=responses, total=total, limit=limit, offset=offset)

    def cancel_booking(self, booking_id: int) -> BookingResponse:
        booking = self._booking_repo.get_by_id(booking_id)
        if booking is None:
            raise BookingService.NotFoundError(f"Booking {booking_id} not found")

        if booking.status == BookingStatus.CANCELLED:
            raise BookingService.InvalidStateError("Booking is already cancelled")

        booking.status = BookingStatus.CANCELLED
        self._booking_repo.update(booking)

        snapshot = self._snapshot_repo.get_by_room_id(booking.room_id)
        return self._to_response(booking, snapshot.name if snapshot else None)

    def update_booking(
        self, booking_id: int, dto: BookingUpdate, user_id: str
    ) -> BookingResponse:
        booking = self._booking_repo.get_by_id(booking_id)
        if booking is None:
            raise BookingService.NotFoundError(f"Booking {booking_id} not found")

        # Only CONFIRMED bookings can be updated
        if booking.status != BookingStatus.CONFIRMED:
            raise BookingService.InvalidStateError(
                f"Cannot update booking with status={booking.status}"
            )

        changes = dto.model_dump(exclude_unset=True)
        time_changed = "start_at" in changes or "end_at" in changes

        # Apply scalar field changes first
        for field in ("num_attendees", "start_at", "end_at", "room_id"):
            if field in changes:
                setattr(booking, field, changes[field])

        # If time changed, re-validate past + overlap
        if time_changed:
            if booking.start_at <= datetime.now(UTC):
                raise BookingService.PastBookingError(
                    "Updated booking start time must be in the future"
                )
            if self._booking_repo.has_overlap(
                booking.room_id, booking.start_at, booking.end_at, exclude_id=booking_id
            ):
                raise BookingService.OverlapError(
                    "Updated time slot overlaps an existing booking"
                )

        # Replace attendees list if provided
        if "attendees" in changes and changes["attendees"] is not None:
            booking.attendees = [
                BookingAttendee(attendee_email=a.email, name=a.name)
                for a in dto.attendees
            ]

        self._booking_repo.update(booking)

        snapshot = self._snapshot_repo.get_by_room_id(booking.room_id)
        return self._to_response(booking, snapshot.name if snapshot else None)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _to_response(self, booking: Booking, room_name: str | None) -> BookingResponse:
        attendees = [
            AttendeeResponse(
                id=a.id,
                attendee_email=a.attendee_email,
                name=a.name,
            )
            for a in booking.attendees
        ]
        return BookingResponse(
            id=booking.id,
            room_id=booking.room_id,
            user_id=booking.user_id,
            start_at=booking.start_at,
            end_at=booking.end_at,
            num_attendees=booking.num_attendees,
            status=booking.status,
            checked_in_at=booking.checked_in_at,
            auto_cancelled_at=booking.auto_cancelled_at,
            created_at=booking.created_at,
            updated_at=booking.updated_at,
            room_name=room_name,
            attendees=attendees,
        )
