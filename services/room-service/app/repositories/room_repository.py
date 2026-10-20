"""Room repository — database queries (tương đương @Repository trong Spring).

Tất cả queries tự động lọc soft-deleted rooms (WHERE deleted_at IS NULL).
Đây là nơi duy nhất SQL chạm vào bảng rooms.

flush() thay vì commit() — service/router kiểm soát transaction boundary.
updated_at set thủ công vì server_default chỉ áp dụng khi INSERT, không phải UPDATE.
"""

import logging
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.room import Room

logger = logging.getLogger(__name__)


class RoomRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def create(self, room: Room) -> Room:
        self._db.add(room)
        self._db.flush()
        self._db.refresh(room)
        return room

    def get_by_id(self, room_id: int) -> Room | None:
        stmt = select(Room).where(Room.id == room_id, Room.deleted_at.is_(None))
        return self._db.scalars(stmt).first()

    def list_rooms(
        self,
        *,
        status: str | None = None,
        q: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Room], int]:
        base = select(Room).where(Room.deleted_at.is_(None))

        if status:
            base = base.where(Room.status == status)
        if q:
            base = base.where(Room.name.ilike(f"%{q}%"))

        total = self._db.scalar(select(func.count()).select_from(base.subquery()))
        rooms = list(self._db.scalars(base.order_by(Room.id).limit(limit).offset(offset)).all())
        return rooms, total or 0

    def update(self, room: Room) -> Room:
        room.updated_at = datetime.now(UTC)
        self._db.flush()
        self._db.refresh(room)
        return room

    def soft_delete(self, room: Room) -> None:
        now = datetime.now(UTC)
        room.deleted_at = now
        room.updated_at = now
        self._db.flush()

    def name_exists(self, name: str, *, exclude_id: int | None = None) -> bool:
        """Kiểm tra active room với tên này đã tồn tại chưa (partial unique guard)."""
        stmt = select(func.count()).where(
            Room.name == name,
            Room.deleted_at.is_(None),
        )
        if exclude_id is not None:
            stmt = stmt.where(Room.id != exclude_id)
        return (self._db.scalar(stmt) or 0) > 0
