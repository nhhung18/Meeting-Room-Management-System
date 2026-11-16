"""Equipment CRUD endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import current_user, require_room_manager
from app.db.session import get_db
from app.schemas.equipment import (
    EquipmentCreate,
    EquipmentListResponse,
    EquipmentResponse,
    EquipmentUpdate,
)
from app.services.equipment_service import EquipmentService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["equipment"])


def _get_service(db: Session = Depends(get_db)) -> EquipmentService:
    return EquipmentService(db)


@router.get("/equipment", response_model=EquipmentListResponse)
def list_equipment(
    q: str | None = Query(None),
    category: str | None = Query(None),
    status: str | None = Query(None),
    room_id: int | None = Query(None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _user=Depends(current_user),
    service: EquipmentService = Depends(_get_service),
) -> EquipmentListResponse:
    return service.list_all(
        category=category,
        status=status,
        room_id=room_id,
        q=q,
        limit=limit,
        offset=offset,
    )


@router.get("/equipment/{equipment_id}", response_model=EquipmentResponse)
def get_equipment(
    equipment_id: int,
    _user=Depends(current_user),
    service: EquipmentService = Depends(_get_service),
) -> EquipmentResponse:
    try:
        return service.get(equipment_id)
    except EquipmentService.NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/equipment", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
def create_equipment(
    body: EquipmentCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_room_manager),
    service: EquipmentService = Depends(_get_service),
) -> EquipmentResponse:
    try:
        result = service.create(body)
        db.commit()
        return result
    except EquipmentService.InvalidStatusError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.patch("/equipment/{equipment_id}", response_model=EquipmentResponse)
def update_equipment(
    equipment_id: int,
    body: EquipmentUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_room_manager),
    service: EquipmentService = Depends(_get_service),
) -> EquipmentResponse:
    try:
        result = service.update(equipment_id, body)
        db.commit()
        return result
    except EquipmentService.NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except EquipmentService.InvalidStatusError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete("/equipment/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_room_manager),
    service: EquipmentService = Depends(_get_service),
) -> None:
    try:
        service.delete(equipment_id)
        db.commit()
    except EquipmentService.NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{room_id}/equipment", response_model=list[EquipmentResponse])
def list_equipment_by_room(
    room_id: int,
    _user=Depends(current_user),
    service: EquipmentService = Depends(_get_service),
) -> list[EquipmentResponse]:
    return service.list_by_room(room_id)
