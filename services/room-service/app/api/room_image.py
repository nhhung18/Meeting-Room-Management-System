"""Room image upload endpoint — Cloudinary (FR-02-6)."""

import logging

from common.auth import TokenPayload
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.security import require_room_manager
from app.db.session import get_db
from app.repositories.room_repository import RoomRepository
from app.schemas.room import RoomResponse
from app.services.room_service import RoomService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["rooms"])

_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def _get_service(db: Session = Depends(get_db)) -> RoomService:
    return RoomService(RoomRepository(db))


@router.post(
    "/{room_id}/image",
    response_model=RoomResponse,
    summary="Upload room image to Cloudinary",
)
def upload_room_image(
    room_id: int,
    file: UploadFile,
    _user: TokenPayload = Depends(require_room_manager),
    service: RoomService = Depends(_get_service),
    db: Session = Depends(get_db),
):
    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type '{file.content_type}'. Allowed: jpeg, png, webp.",
        )

    file_bytes = file.file.read()
    if len(file_bytes) > _MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 5 MB.",
        )

    try:
        result = service.upload_image(room_id, file_bytes, file.filename or "")
        db.commit()
        return result
    except RoomService.NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        ) from None
    except RoomService.CloudinaryError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        ) from None
