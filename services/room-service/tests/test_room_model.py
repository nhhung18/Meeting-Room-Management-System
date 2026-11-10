"""Unit tests for Room ORM model — validates column names, types, and defaults."""

from app.models.room import Room, RoomStatus


def test_room_tablename():
    assert Room.__tablename__ == "rooms"


def test_room_has_expected_columns():
    col_names = {c.name for c in Room.__table__.columns}
    expected = {
        "id",
        "name",
        "capacity",
        "status",
        "equipment",
        "owner_id",
        "floor",
        "description",
        "image_url",
        "created_at",
        "updated_at",
        "deleted_at",
    }
    assert expected == col_names


def test_room_new_fields_are_nullable():
    for col_name in ("floor", "description", "image_url"):
        col = Room.__table__.c[col_name]
        assert col.nullable is True, f"{col_name} should be nullable"


def test_room_status_server_default():
    status_col = Room.__table__.c.status
    assert status_col.server_default is not None


def test_room_status_enum_values():
    assert RoomStatus.AVAILABLE == "AVAILABLE"
    assert RoomStatus.MAINTENANCE == "MAINTENANCE"
    assert RoomStatus.ARCHIVED == "ARCHIVED"


def test_room_deleted_at_is_nullable():
    deleted_at_col = Room.__table__.c.deleted_at
    assert deleted_at_col.nullable is True


def test_room_equipment_has_server_default():
    equipment_col = Room.__table__.c.equipment
    assert equipment_col.server_default is not None
