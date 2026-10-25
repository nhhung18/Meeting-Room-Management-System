"""Unit tests cho Booking Pydantic schemas — validation rules từ docs/assumptions.md."""

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.schemas.booking import AttendeeInput, BookingCreate, BookingUpdate


def _future(hours: int = 1) -> datetime:
    return datetime.now(UTC) + timedelta(hours=hours)


# ---------------------------------------------------------------------------
# BookingCreate
# ---------------------------------------------------------------------------


def test_booking_create_valid():
    dto = BookingCreate(
        room_id=1,
        start_at=_future(1),
        end_at=_future(2),
        num_attendees=5,
    )
    assert dto.room_id == 1
    assert dto.num_attendees == 5
    assert dto.attendees == []


def test_booking_create_end_before_start_rejected():
    with pytest.raises(ValidationError, match="end_at must be after start_at"):
        BookingCreate(
            room_id=1,
            start_at=_future(2),
            end_at=_future(1),
            num_attendees=5,
        )


def test_booking_create_end_equals_start_rejected():
    t = _future(1)
    with pytest.raises(ValidationError, match="end_at must be after start_at"):
        BookingCreate(room_id=1, start_at=t, end_at=t, num_attendees=5)


def test_booking_create_zero_attendees_rejected():
    with pytest.raises(ValidationError):
        BookingCreate(
            room_id=1,
            start_at=_future(1),
            end_at=_future(2),
            num_attendees=0,
        )


def test_booking_create_negative_attendees_rejected():
    with pytest.raises(ValidationError):
        BookingCreate(
            room_id=1,
            start_at=_future(1),
            end_at=_future(2),
            num_attendees=-1,
        )


def test_booking_create_naive_datetime_rejected():
    naive = datetime(2099, 1, 1, 9, 0)  # no tzinfo
    with pytest.raises(ValidationError, match="timezone"):
        BookingCreate(
            room_id=1,
            start_at=naive,
            end_at=naive + timedelta(hours=1),
            num_attendees=5,
        )


def test_booking_create_with_attendees():
    dto = BookingCreate(
        room_id=1,
        start_at=_future(1),
        end_at=_future(2),
        num_attendees=2,
        attendees=[AttendeeInput(email="a@b.com", name="Alice")],
    )
    assert len(dto.attendees) == 1
    assert dto.attendees[0].email == "a@b.com"


def test_booking_create_zero_room_id_rejected():
    with pytest.raises(ValidationError):
        BookingCreate(
            room_id=0,
            start_at=_future(1),
            end_at=_future(2),
            num_attendees=5,
        )


# ---------------------------------------------------------------------------
# BookingUpdate
# ---------------------------------------------------------------------------


def test_booking_update_partial():
    dto = BookingUpdate(num_attendees=10)
    assert dto.start_at is None
    assert dto.num_attendees == 10


def test_booking_update_empty_is_valid():
    dto = BookingUpdate()
    assert dto.model_dump(exclude_unset=True) == {}


def test_booking_update_end_before_start_rejected():
    with pytest.raises(ValidationError, match="end_at must be after start_at"):
        BookingUpdate(start_at=_future(2), end_at=_future(1))


def test_booking_update_only_end_at_no_error():
    # end_at alone without start_at should not trigger the cross-field validator
    dto = BookingUpdate(end_at=_future(3))
    assert dto.end_at is not None
    assert dto.start_at is None


# ---------------------------------------------------------------------------
# AttendeeInput
# ---------------------------------------------------------------------------


def test_attendee_input_valid():
    a = AttendeeInput(email="alice@example.com", name="Alice")
    assert a.email == "alice@example.com"
    assert a.name == "Alice"


def test_attendee_input_blank_name_rejected():
    with pytest.raises(ValidationError):
        AttendeeInput(email="a@b.com", name="   ")


def test_attendee_input_strips_name():
    a = AttendeeInput(email="a@b.com", name="  Alice  ")
    assert a.name == "Alice"


def test_attendee_input_invalid_email_rejected():
    with pytest.raises(ValidationError):
        AttendeeInput(email="not-an-email", name="Alice")


def test_attendee_input_empty_name_rejected():
    with pytest.raises(ValidationError):
        AttendeeInput(email="a@b.com", name="")
