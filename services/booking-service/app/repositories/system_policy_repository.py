"""SystemPolicyRepository — CRUD cho system_policies table.

Pattern: flush() trong repo, commit() trong router.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.system_policy import SystemPolicy


class SystemPolicyRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get(self, key: str) -> SystemPolicy | None:
        stmt = select(SystemPolicy).where(SystemPolicy.key == key)
        return self._db.execute(stmt).scalar_one_or_none()

    def list_all(self) -> list[SystemPolicy]:
        stmt = select(SystemPolicy).order_by(SystemPolicy.key)
        return list(self._db.execute(stmt).scalars().all())

    def upsert(
        self,
        key: str,
        value,
        updated_by: str | None = None,
    ) -> SystemPolicy:
        """INSERT nếu key chưa tồn tại, UPDATE nếu đã có."""
        existing = self.get(key)
        if existing is None:
            policy = SystemPolicy(
                key=key,
                value=value,
                updated_by=updated_by,
                updated_at=datetime.now(UTC),
            )
            self._db.add(policy)
            self._db.flush()
            return policy

        existing.value = value
        existing.updated_by = updated_by
        existing.updated_at = datetime.now(UTC)
        self._db.flush()
        return existing
