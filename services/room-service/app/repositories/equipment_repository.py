"""Equipment repository — queries cho equipment_items + equipment_room_assignments."""

import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.equipment_item import EquipmentItem, EquipmentRoomAssignment

logger = logging.getLogger(__name__)


class EquipmentRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def create(self, item: EquipmentItem) -> EquipmentItem:
        self._db.add(item)
        self._db.flush()
        self._db.refresh(item)
        return item

    def get_by_id(self, equipment_id: int) -> EquipmentItem | None:
        stmt = select(EquipmentItem).where(
            EquipmentItem.id == equipment_id,
            EquipmentItem.deleted_at.is_(None),
        )
        return self._db.scalars(stmt).first()

    def list_all(
        self,
        *,
        category: str | None = None,
        status: str | None = None,
        room_id: int | None = None,
        q: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[EquipmentItem], int]:
        stmt = select(EquipmentItem).where(EquipmentItem.deleted_at.is_(None))

        if category and category != "ALL":
            stmt = stmt.where(EquipmentItem.category == category)
        if status and status != "ALL":
            stmt = stmt.where(EquipmentItem.status == status)
        if q:
            stmt = stmt.where(
                EquipmentItem.name.ilike(f"%{q}%")
                | EquipmentItem.serial_number.ilike(f"%{q}%")
            )
        if room_id == -1:  # UNASSIGNED
            assigned_ids = select(EquipmentRoomAssignment.equipment_id)
            stmt = stmt.where(EquipmentItem.id.not_in(assigned_ids))
        elif room_id is not None:
            assigned_ids = select(EquipmentRoomAssignment.equipment_id).where(
                EquipmentRoomAssignment.room_id == room_id
            )
            stmt = stmt.where(EquipmentItem.id.in_(assigned_ids))

        total = len(self._db.scalars(stmt).all())
        items = self._db.scalars(stmt.offset(offset).limit(limit)).all()
        return list(items), total

    def list_by_room(self, room_id: int) -> list[EquipmentItem]:
        assigned_ids = select(EquipmentRoomAssignment.equipment_id).where(
            EquipmentRoomAssignment.room_id == room_id
        )
        stmt = select(EquipmentItem).where(
            EquipmentItem.id.in_(assigned_ids),
            EquipmentItem.deleted_at.is_(None),
        )
        return list(self._db.scalars(stmt).all())

    def update(self, item: EquipmentItem) -> EquipmentItem:
        item.updated_at = datetime.now(UTC)
        self._db.flush()
        self._db.refresh(item)
        return item

    def soft_delete(self, item: EquipmentItem) -> None:
        item.deleted_at = datetime.now(UTC)
        self._db.flush()

    def set_room_assignments(self, equipment_id: int, room_ids: list[int]) -> None:
        """Replace toàn bộ room assignments cho một thiết bị."""
        stmt = select(EquipmentRoomAssignment).where(
            EquipmentRoomAssignment.equipment_id == equipment_id
        )
        existing = list(self._db.scalars(stmt).all())
        for a in existing:
            self._db.delete(a)
        self._db.flush()

        for room_id in room_ids:
            self._db.add(
                EquipmentRoomAssignment(equipment_id=equipment_id, room_id=room_id)
            )
        self._db.flush()

    def get_room_ids_for_equipment(self, equipment_id: int) -> list[int]:
        stmt = select(EquipmentRoomAssignment.room_id).where(
            EquipmentRoomAssignment.equipment_id == equipment_id
        )
        return list(self._db.scalars(stmt).all())
