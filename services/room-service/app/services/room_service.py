"""Room business logic (tương đương @Service trong Spring).

Nằm giữa API router và repository:
- Validation cần DB state (duplicate name)
- Map DTO → ORM object
- Raise domain exceptions (router chuyển thành HTTP errors)

Transaction: service gọi repo.flush(), commit do router quyết định.
"""

import logging

from app.models.room import Room
from app.repositories.room_repository import RoomRepository
from app.schemas.room import RoomCreate, RoomListResponse, RoomResponse, RoomUpdate

logger = logging.getLogger(__name__)


class RoomService:
    class NotFoundError(Exception):
        """Room không tồn tại hoặc đã bị soft-delete."""

    class DuplicateNameError(Exception):
        """Active room với tên này đã tồn tại."""

    def __init__(self, repo: RoomRepository) -> None:
        self._repo = repo

    def create_room(self, dto: RoomCreate) -> RoomResponse:
        if self._repo.name_exists(dto.name):
            raise self.DuplicateNameError(f"Room name '{dto.name}' already exists")

        room = Room(
            name=dto.name,
            capacity=dto.capacity,
            equipment=dto.equipment,
            owner_id=dto.owner_id,
        )
        if dto.status is not None:
            room.status = dto.status.value

        room = self._repo.create(room)
        return RoomResponse.model_validate(room)

    def get_room(self, room_id: int) -> RoomResponse:
        room = self._repo.get_by_id(room_id)
        if room is None:
            raise self.NotFoundError(f"Room {room_id} not found")
        return RoomResponse.model_validate(room)

    def list_rooms(
        self,
        *,
        status: str | None = None,
        q: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> RoomListResponse:
        rooms, total = self._repo.list_rooms(status=status, q=q, limit=limit, offset=offset)
        return RoomListResponse(
            items=[RoomResponse.model_validate(r) for r in rooms],
            total=total,
            limit=limit,
            offset=offset,
        )

    def update_room(self, room_id: int, dto: RoomUpdate) -> RoomResponse:
        room = self._repo.get_by_id(room_id)
        if room is None:
            raise self.NotFoundError(f"Room {room_id} not found")

        update_data = dto.model_dump(exclude_unset=True)

        if (
            "name" in update_data
            and update_data["name"] != room.name
            and self._repo.name_exists(update_data["name"], exclude_id=room_id)
        ):
            raise self.DuplicateNameError(f"Room name '{update_data['name']}' already exists")

        for field, value in update_data.items():
            if field == "status" and value is not None and hasattr(value, "value"):
                value = value.value
            setattr(room, field, value)

        room = self._repo.update(room)
        return RoomResponse.model_validate(room)

    def delete_room(self, room_id: int) -> None:
        room = self._repo.get_by_id(room_id)
        if room is None:
            raise self.NotFoundError(f"Room {room_id} not found")
        self._repo.soft_delete(room)
