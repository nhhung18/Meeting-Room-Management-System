"""Room business logic (tương đương @Service trong Spring).

Nằm giữa API router và repository:
- Validation cần DB state (duplicate name)
- Map DTO → ORM object
- Raise domain exceptions (router chuyển thành HTTP errors)

Transaction: service gọi repo.flush(), commit do router quyết định.
"""

import logging

import cloudinary
import cloudinary.uploader

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

    class CloudinaryError(Exception):
        """Lỗi khi upload ảnh lên Cloudinary."""

    def create_room(self, dto: RoomCreate) -> RoomResponse:
        if self._repo.name_exists(dto.name):
            raise self.DuplicateNameError(f"Room name '{dto.name}' already exists")

        room = Room(
            name=dto.name,
            capacity=dto.capacity,
            floor=dto.floor,
            equipment=dto.equipment,
            owner_id=dto.owner_id,
            description=dto.description,
            image_url=dto.image_url,
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

    def update_room(self, room_id: int, dto: RoomUpdate) -> tuple[RoomResponse, str]:
        """Returns (updated room, previous_status)."""
        room = self._repo.get_by_id(room_id)
        if room is None:
            raise self.NotFoundError(f"Room {room_id} not found")

        previous_status = room.status
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
        return RoomResponse.model_validate(room), previous_status

    def delete_room(self, room_id: int) -> None:
        room = self._repo.get_by_id(room_id)
        if room is None:
            raise self.NotFoundError(f"Room {room_id} not found")
        self._repo.soft_delete(room)

    def upload_image(self, room_id: int, file_bytes: bytes, filename: str) -> RoomResponse:
        """Upload ảnh lên Cloudinary và lưu secure_url vào room.image_url."""
        room = self._repo.get_by_id(room_id)
        if room is None:
            raise self.NotFoundError(f"Room {room_id} not found")

        try:
            result = cloudinary.uploader.upload(
                file_bytes,
                public_id=f"rooms/{room_id}",
                overwrite=True,
                resource_type="image",
            )
        except Exception as e:
            logger.error("cloudinary upload failed for room %s: %s", room_id, e)
            raise self.CloudinaryError(f"Failed to upload image: {e}") from e

        room.image_url = result["secure_url"]
        room = self._repo.update(room)
        return RoomResponse.model_validate(room)
