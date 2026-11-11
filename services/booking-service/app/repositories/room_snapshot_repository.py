"""RoomSnapshotRepository — data-access layer cho bảng room_snapshots.

Pattern: flush() trong repo, commit() trong router.
upsert() có version guard (ADR-0003): bỏ qua nếu incoming_version <= existing.version.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import JSONB
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
        *,
        floor: str | None = None,
    ) -> RoomSnapshot | None:
        existing = self.get_by_room_id(room_id)

        if existing is None:
            snap = RoomSnapshot(
                room_id=room_id,
                name=name,
                capacity=capacity,
                status=status,
                floor=floor,
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
        existing.floor = floor
        existing.equipment = equipment
        existing.owner_id = owner_id
        existing.version = version
        existing.last_synced = datetime.now(UTC)
        self._db.flush()
        return existing

    def delete_by_room_id(self, room_id: int) -> None:
        stmt = select(RoomSnapshot).where(RoomSnapshot.room_id == room_id)
        snap = self._db.execute(stmt).scalar_one_or_none()
        if snap is not None:
            self._db.delete(snap)
            self._db.flush()

    def list_available(self, *, min_capacity: int = 0) -> list[RoomSnapshot]:
        stmt = select(RoomSnapshot).where(RoomSnapshot.status == "AVAILABLE")
        if min_capacity > 0:
            stmt = stmt.where(RoomSnapshot.capacity >= min_capacity)
        return list(self._db.execute(stmt).scalars().all())

    def find_available(
        self,
        *,
        start_at: datetime,
        end_at: datetime,
        min_capacity: int = 0,
        floor: str | None = None,
        equipment: list[str] | None = None,
    ) -> list[RoomSnapshot]:
        """AVAILABLE snapshots whose room_id has no overlapping CONFIRMED/CHECKED_IN booking."""
        from app.models.booking import Booking, BookingStatus

        booked_subq = (
            select(Booking.room_id)
            .where(
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
                Booking.start_at < end_at,
                Booking.end_at > start_at,
            )
            .scalar_subquery()
        )

        stmt = select(RoomSnapshot).where(
            RoomSnapshot.status == "AVAILABLE",
            RoomSnapshot.room_id.not_in(booked_subq),
        )

        if min_capacity > 0:
            stmt = stmt.where(RoomSnapshot.capacity >= min_capacity)
        if floor is not None:
            stmt = stmt.where(RoomSnapshot.floor == floor)
        if equipment:
            # JSONB containment: snapshot.equipment @> requested_equipment
            import json

            from sqlalchemy import cast as sa_cast
            from sqlalchemy import literal

            stmt = stmt.where(
                RoomSnapshot.equipment.op("@>")(sa_cast(literal(json.dumps(equipment)), JSONB))
            )

        return list(self._db.execute(stmt).scalars().all())
