"""RoomSnapshotRepository — data-access layer cho bảng room_snapshots.

Pattern: flush() trong repo, commit() trong router.
upsert() có version guard (ADR-0003): bỏ qua nếu incoming_version <= existing.version.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.room_snapshot import RoomSnapshot


class RoomSnapshotRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_by_room_id(self, room_id: int) -> RoomSnapshot | None:
        stmt = select(RoomSnapshot).where(RoomSnapshot.room_id == room_id)
        return self._db.execute(stmt).scalar_one_or_none()

    def upsert(
        self,
        room_id: int,
        name: str,
        capacity: int,
        status: str,
        equipment: list,
        owner_id: str | None,
        version: int,
    ) -> RoomSnapshot | None:
        existing = self.get_by_room_id(room_id)

        if existing is None:
            snap = RoomSnapshot(
                room_id=room_id,
                name=name,
                capacity=capacity,
                status=status,
                equipment=equipment,
                owner_id=owner_id,
                version=version,
                last_synced=datetime.now(UTC),
            )
            self._db.add(snap)
            self._db.flush()
            return snap

        # Version guard (ADR-0003): skip if incoming is same or older
        if version <= existing.version:
            return None

        existing.name = name
        existing.capacity = capacity
        existing.status = status
        existing.equipment = equipment
        existing.owner_id = owner_id
        existing.version = version
        existing.last_synced = datetime.now(UTC)
        self._db.flush()
        return existing

    def list_available(self, *, min_capacity: int = 0) -> list[RoomSnapshot]:
        stmt = select(RoomSnapshot).where(RoomSnapshot.status == "AVAILABLE")
        if min_capacity > 0:
            stmt = stmt.where(RoomSnapshot.capacity >= min_capacity)
        return list(self._db.execute(stmt).scalars().all())
