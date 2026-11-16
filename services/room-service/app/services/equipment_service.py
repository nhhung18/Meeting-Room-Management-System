"""EquipmentService — business logic cho equipment management."""

import logging

from sqlalchemy.orm import Session

from app.models.equipment_item import EquipmentItem
from app.models.room import Room
from app.repositories.equipment_repository import EquipmentRepository
from app.repositories.room_repository import RoomRepository
from app.schemas.equipment import (
    EquipmentCreate,
    EquipmentListResponse,
    EquipmentResponse,
    EquipmentRoomInfo,
    EquipmentUpdate,
)

logger = logging.getLogger(__name__)

VALID_STATUSES = {"FUNCTIONAL", "UNDER_REPAIR", "DECOMMISSIONED"}


class EquipmentService:
    class NotFoundError(Exception):
        pass

    class InvalidStatusError(Exception):
        pass

    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = EquipmentRepository(db)
        self._room_repo = RoomRepository(db)

    def create(self, dto: EquipmentCreate) -> EquipmentResponse:
        if dto.status not in VALID_STATUSES:
            raise self.InvalidStatusError(f"Invalid status: {dto.status}")

        item = EquipmentItem(
            name=dto.name.strip(),
            category=dto.category.strip(),
            status=dto.status,
            serial_number=dto.serial_number,
            notes=dto.notes,
        )
        item = self._repo.create(item)

        if dto.room_ids:
            self._repo.set_room_assignments(item.id, dto.room_ids)
            self._sync_room_equipment_jsonb(dto.room_ids)

        self._db.refresh(item)
        return self._to_response(item)

    def get(self, equipment_id: int) -> EquipmentResponse:
        item = self._repo.get_by_id(equipment_id)
        if item is None:
            raise self.NotFoundError(f"Equipment {equipment_id} not found")
        return self._to_response(item)

    def list_all(
        self,
        *,
        category: str | None = None,
        status: str | None = None,
        room_id: int | None = None,
        q: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> EquipmentListResponse:
        items, total = self._repo.list_all(
            category=category,
            status=status,
            room_id=room_id,
            q=q,
            limit=limit,
            offset=offset,
        )
        return EquipmentListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
        )

    def list_by_room(self, room_id: int) -> list[EquipmentResponse]:
        items = self._repo.list_by_room(room_id)
        return [self._to_response(i) for i in items]

    def update(self, equipment_id: int, dto: EquipmentUpdate) -> EquipmentResponse:
        item = self._repo.get_by_id(equipment_id)
        if item is None:
            raise self.NotFoundError(f"Equipment {equipment_id} not found")

        changes = dto.model_dump(exclude_unset=True)

        if "status" in changes and changes["status"] not in VALID_STATUSES:
            raise self.InvalidStatusError(f"Invalid status: {changes['status']}")

        for field in ("name", "category", "status", "serial_number", "notes"):
            if field in changes:
                val = changes[field]
                setattr(item, field, val.strip() if isinstance(val, str) else val)

        item = self._repo.update(item)

        if "room_ids" in changes:
            old_room_ids = self._repo.get_room_ids_for_equipment(equipment_id)
            self._repo.set_room_assignments(equipment_id, changes["room_ids"])
            affected = list(set(old_room_ids) | set(changes["room_ids"]))
            self._sync_room_equipment_jsonb(affected)

        self._db.refresh(item)
        return self._to_response(item)

    def delete(self, equipment_id: int) -> None:
        item = self._repo.get_by_id(equipment_id)
        if item is None:
            raise self.NotFoundError(f"Equipment {equipment_id} not found")

        room_ids = self._repo.get_room_ids_for_equipment(equipment_id)
        self._repo.set_room_assignments(equipment_id, [])
        self._repo.soft_delete(item)

        if room_ids:
            self._sync_room_equipment_jsonb(room_ids)

    def _sync_room_equipment_jsonb(self, room_ids: list[int]) -> None:
        """Cập nhật rooms.equipment JSONB để reflect danh sách category thực tế."""
        for room_id in room_ids:
            room = self._room_repo.get_by_id(room_id)
            if room is None:
                continue
            items = self._repo.list_by_room(room_id)
            categories = sorted({i.category for i in items})
            room.equipment = categories
            self._db.flush()

    def _to_response(self, item: EquipmentItem) -> EquipmentResponse:
        rooms: list[EquipmentRoomInfo] = []
        for assignment in item.assignments:
            room = self._room_repo.get_by_id(assignment.room_id)
            rooms.append(
                EquipmentRoomInfo(
                    room_id=assignment.room_id,
                    room_name=room.name if room else None,
                )
            )
        return EquipmentResponse(
            id=item.id,
            name=item.name,
            category=item.category,
            status=item.status,
            serial_number=item.serial_number,
            notes=item.notes,
            rooms=rooms,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
