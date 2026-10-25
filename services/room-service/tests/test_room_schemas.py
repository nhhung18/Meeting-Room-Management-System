"""Unit tests cho room Pydantic schemas — kiểm tra validation rules."""

import pytest
from pydantic import ValidationError

from app.schemas.room import RoomCreate, RoomUpdate


def test_room_create_minimal():
    dto = RoomCreate(name="P101", capacity=10)
    assert dto.name == "P101"
    assert dto.capacity == 10
    assert dto.equipment == []
    assert dto.status is None


def test_room_create_with_equipment():
    dto = RoomCreate(name="P102", capacity=20, equipment=["projector", "whiteboard"])
    assert dto.equipment == ["projector", "whiteboard"]


def test_room_create_rejects_zero_capacity():
    with pytest.raises(ValidationError):
        RoomCreate(name="P101", capacity=0)


def test_room_create_rejects_negative_capacity():
    with pytest.raises(ValidationError):
        RoomCreate(name="P101", capacity=-5)


def test_room_create_rejects_invalid_status():
    with pytest.raises(ValidationError):
        RoomCreate(name="P101", capacity=10, status="INVALID")


def test_room_create_rejects_empty_name():
    with pytest.raises(ValidationError):
        RoomCreate(name="", capacity=10)


def test_room_create_strips_whitespace():
    dto = RoomCreate(name="  P101  ", capacity=10)
    assert dto.name == "P101"


def test_room_create_rejects_blank_name():
    with pytest.raises(ValidationError):
        RoomCreate(name="   ", capacity=10)


def test_room_create_equipment_deduplicates():
    dto = RoomCreate(name="P101", capacity=10, equipment=["projector", "projector"])
    assert dto.equipment == ["projector"]


def test_room_create_equipment_deduplicates_preserves_order():
    dto = RoomCreate(name="P101", capacity=10, equipment=["whiteboard", "projector", "whiteboard"])
    assert dto.equipment == ["whiteboard", "projector"]


def test_room_update_all_optional():
    dto = RoomUpdate()
    assert dto.name is None
    assert dto.capacity is None
    assert dto.status is None
    assert dto.equipment is None


def test_room_update_rejects_zero_capacity():
    with pytest.raises(ValidationError):
        RoomUpdate(capacity=0)


def test_room_update_accepts_valid_status():
    dto = RoomUpdate(status="MAINTENANCE")
    assert dto.status == "MAINTENANCE"


def test_room_update_rejects_invalid_status():
    with pytest.raises(ValidationError):
        RoomUpdate(status="BROKEN")


def test_room_update_strips_whitespace():
    dto = RoomUpdate(name="  P103  ")
    assert dto.name == "P103"


def test_room_update_rejects_blank_name():
    with pytest.raises(ValidationError):
        RoomUpdate(name="   ")
