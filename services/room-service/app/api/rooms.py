"""Room CRUD endpoints (tương đương @RestController trong Spring).

Map HTTP request → RoomService call → HTTP response.
Domain exceptions (NotFoundError, DuplicateNameError) → HTTP status codes.

Transaction: commit do router quyết định sau khi service thành công.
"""

import json
import logging

from common.auth import TokenPayload
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import current_user, require_room_manager
from app.db.session import get_db
from app.models.outbox_event import OutboxEvent
from app.repositories.room_repository import RoomRepository
from app.schemas.room import RoomCreate, RoomListResponse, RoomResponse, RoomUpdate
from app.services.room_service import RoomService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["rooms"])


def _get_service(db: Session = Depends(get_db)) -> RoomService:
    """Build RoomService per-request từ injected DB session."""
    return RoomService(RoomRepository(db))


@router.post("/", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(
    body: RoomCreate,
    _user: TokenPayload = Depends(require_room_manager),
    service: RoomService = Depends(_get_service),
    db: Session = Depends(get_db),
):
    try:
        result = service.create_room(body)
        db.add(
            OutboxEvent(
                event_type="room.created",
                payload=json.dumps(
                    {
                        "room_id": result.id,
                        "name": result.name,
                        "capacity": result.capacity,
                        "status": result.status,
                        "floor": result.floor,
                        "equipment": result.equipment,
                        "owner_id": result.owner_id,
                        "version": result.id,
                    }
                ),
            )
        )
        db.commit()
        return result
    except RoomService.DuplicateNameError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from None


@router.get("/", response_model=RoomListResponse)
def list_rooms(
    status_filter: str | None = Query(None, alias="status"),
    q: str | None = Query(None, max_length=100),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _user: TokenPayload = Depends(current_user),
    service: RoomService = Depends(_get_service),
):
    return service.list_rooms(status=status_filter, q=q, limit=limit, offset=offset)


@router.get("/{room_id}", response_model=RoomResponse)
def get_room(
    room_id: int,
    _user: TokenPayload = Depends(current_user),
    service: RoomService = Depends(_get_service),
):
    try:
        return service.get_room(room_id)
    except RoomService.NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        ) from None


@router.patch("/{room_id}", response_model=RoomResponse)
def update_room(
    room_id: int,
    body: RoomUpdate,
    _user: TokenPayload = Depends(require_room_manager),
    service: RoomService = Depends(_get_service),
    db: Session = Depends(get_db),
):
    try:
        result, previous_status = service.update_room(room_id, body)
        # Publish room.updated event (booking-service listens to sync snapshots)
        db.add(
            OutboxEvent(
                event_type="room.updated",
                payload=json.dumps(
                    {
                        "room_id": result.id,
                        "name": result.name,
                        "capacity": result.capacity,
                        "status": result.status,
                        "floor": result.floor,
                        "equipment": result.equipment,
                        "owner_id": result.owner_id,
                        "version": result.id,
                    }
                ),
            )
        )
        # Maintenance notification (additional event for notification-worker)
        if result.status == "MAINTENANCE" and previous_status != "MAINTENANCE":
            db.add(
                OutboxEvent(
                    event_type="room.maintenance_started",
                    payload=json.dumps(
                        {
                            "room_id": result.id,
                            "room_name": result.name,
                            "owner_email": result.owner_email,
                        }
                    ),
                )
            )
        db.commit()
        return result
    except RoomService.NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        ) from None
    except RoomService.DuplicateNameError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from None


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(
    room_id: int,
    _user: TokenPayload = Depends(require_room_manager),
    service: RoomService = Depends(_get_service),
    db: Session = Depends(get_db),
):
    try:
        service.delete_room(room_id)
        db.add(
            OutboxEvent(
                event_type="room.deleted",
                payload=json.dumps({"room_id": room_id}),
            )
        )
        db.commit()
    except RoomService.NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        ) from None
