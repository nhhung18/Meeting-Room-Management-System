"""CategoryRepository — queries cho equipment_categories."""

from datetime import UTC, datetime

import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.equipment_category import EquipmentCategory
from app.models.equipment_item import EquipmentItem


class CategoryRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_all(self) -> list[EquipmentCategory]:
        stmt = select(EquipmentCategory).order_by(EquipmentCategory.name)
        return list(self._db.scalars(stmt).all())

    def get_by_id(self, category_id: int) -> EquipmentCategory | None:
        return self._db.get(EquipmentCategory, category_id)

    def get_by_name(self, name: str) -> EquipmentCategory | None:
        stmt = select(EquipmentCategory).where(EquipmentCategory.name == name)
        return self._db.scalars(stmt).first()

    def create(self, cat: EquipmentCategory) -> EquipmentCategory:
        self._db.add(cat)
        self._db.flush()
        self._db.refresh(cat)
        return cat

    def update(self, cat: EquipmentCategory) -> EquipmentCategory:
        cat.updated_at = datetime.now(UTC)
        self._db.flush()
        self._db.refresh(cat)
        return cat

    def delete(self, cat: EquipmentCategory) -> None:
        self._db.delete(cat)
        self._db.flush()

    def count_equipment_using(self, name: str) -> int:
        stmt = (
            select(sa.func.count())
            .select_from(EquipmentItem)
            .where(EquipmentItem.category == name, EquipmentItem.deleted_at.is_(None))
        )
        return self._db.scalar(stmt) or 0

    def rename_equipment_category(self, old_name: str, new_name: str) -> int:
        """Bulk UPDATE equipment_items.category; trả về số rows bị ảnh hưởng."""
        result = self._db.execute(
            sa.update(EquipmentItem)
            .where(EquipmentItem.category == old_name, EquipmentItem.deleted_at.is_(None))
            .values(category=new_name)
        )
        self._db.flush()
        return result.rowcount
