"""CategoryService — business logic cho equipment categories."""

import logging

from sqlalchemy.orm import Session

from app.models.equipment_category import EquipmentCategory
from app.repositories.category_repository import CategoryRepository
from app.schemas.equipment import (
    CategoryCreate,
    CategoryListResponse,
    CategoryResponse,
    CategoryUpdate,
)

logger = logging.getLogger(__name__)


class CategoryService:
    class NotFoundError(Exception):
        pass

    class DuplicateError(Exception):
        pass

    class InUseError(Exception):
        pass

    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = CategoryRepository(db)

    def list_all(self) -> CategoryListResponse:
        cats = self._repo.list_all()
        items = [self._to_response(c) for c in cats]
        return CategoryListResponse(items=items, total=len(items))

    def create(self, dto: CategoryCreate) -> CategoryResponse:
        name = dto.name.strip()
        if self._repo.get_by_name(name) is not None:
            raise self.DuplicateError(f"Category '{name}' already exists")

        cat = EquipmentCategory(name=name, description=dto.description)
        cat = self._repo.create(cat)
        return self._to_response(cat)

    def update(self, category_id: int, dto: CategoryUpdate) -> CategoryResponse:
        cat = self._repo.get_by_id(category_id)
        if cat is None:
            raise self.NotFoundError(f"Category {category_id} not found")

        changes = dto.model_dump(exclude_unset=True)

        if "name" in changes:
            new_name = changes["name"].strip()
            if new_name != cat.name:
                existing = self._repo.get_by_name(new_name)
                if existing is not None:
                    raise self.DuplicateError(f"Category '{new_name}' already exists")
                # Bulk rename equipment_items
                self._repo.rename_equipment_category(cat.name, new_name)
                cat.name = new_name

        if "description" in changes:
            cat.description = changes["description"]

        cat = self._repo.update(cat)
        return self._to_response(cat)

    def delete(self, category_id: int) -> None:
        cat = self._repo.get_by_id(category_id)
        if cat is None:
            raise self.NotFoundError(f"Category {category_id} not found")

        count = self._repo.count_equipment_using(cat.name)
        if count > 0:
            raise self.InUseError(
                f"Cannot delete category '{cat.name}': {count} equipment item(s) still use it"
            )

        self._repo.delete(cat)

    def _to_response(self, cat: EquipmentCategory) -> CategoryResponse:
        return CategoryResponse(
            id=cat.id,
            name=cat.name,
            description=cat.description,
            equipment_count=self._repo.count_equipment_using(cat.name),
            created_at=cat.created_at,
            updated_at=cat.updated_at,
        )
