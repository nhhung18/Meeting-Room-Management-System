"""UserProfileRepository — CRUD cho user_profiles table.

Pattern: flush() trong repo, commit() trong router.
"""

from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.user_profile import UserProfile


class UserProfileRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get(self, user_id: str) -> UserProfile | None:
        return self._db.execute(
            select(UserProfile).where(UserProfile.id == user_id)
        ).scalar_one_or_none()

    def get_by_email(self, email: str) -> UserProfile | None:
        return self._db.execute(
            select(UserProfile).where(UserProfile.email == email)
        ).scalar_one_or_none()

    def list_all(
        self,
        q: str | None = None,
        role: str | None = None,
        status: str | None = None,
        department: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[UserProfile], int]:
        stmt = select(UserProfile)
        if q:
            pattern = f"%{q}%"
            stmt = stmt.where(
                or_(
                    UserProfile.name.ilike(pattern),
                    UserProfile.email.ilike(pattern),
                    UserProfile.department.ilike(pattern),
                )
            )
        if role:
            stmt = stmt.where(UserProfile.role == role)
        if status:
            stmt = stmt.where(UserProfile.status == status)
        if department:
            stmt = stmt.where(UserProfile.department == department)

        total = self._db.execute(
            select(func.count()).select_from(stmt.subquery())
        ).scalar_one()

        items = list(
            self._db.execute(
                stmt.order_by(UserProfile.created_at.desc()).limit(limit).offset(offset)
            ).scalars().all()
        )
        return items, total

    def upsert(self, user_id: str, email: str, name: str, **kwargs) -> UserProfile:
        """JIT provisioning: INSERT nếu chưa có, UPDATE nếu đã có."""
        existing = self.get(user_id)
        if existing is None:
            user = UserProfile(id=user_id, email=email, name=name, **kwargs)
            self._db.add(user)
            self._db.flush()
            return user
        for key, value in {"email": email, "name": name, **kwargs}.items():
            if value is not None:
                setattr(existing, key, value)
        existing.updated_at = datetime.now(UTC)
        self._db.flush()
        return existing

    def update(self, user: UserProfile, data: dict) -> UserProfile:
        for key, value in data.items():
            if value is not None:
                setattr(user, key, value)
        user.updated_at = datetime.now(UTC)
        self._db.flush()
        return user
