"""AuditLog ORM model — ghi lại mọi thay đổi trạng thái booking.

Immutable: chỉ INSERT, không UPDATE/DELETE.
"""

import enum

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuditAction(enum.StrEnum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    CANCEL = "CANCEL"
    CHECK_IN = "CHECK_IN"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    actor_id: Mapped[str] = mapped_column(sa.VARCHAR(255), nullable=False)
    actor_roles: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        server_default=sa.text("'[]'::jsonb"),
    )
    action: Mapped[str] = mapped_column(sa.VARCHAR(50), nullable=False)
    resource_type: Mapped[str] = mapped_column(
        sa.VARCHAR(50),
        nullable=False,
        server_default=sa.text("'booking'"),
    )
    resource_id: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    before_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    after_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    request_id: Mapped[str | None] = mapped_column(sa.VARCHAR(255), nullable=True)
    created_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )

    def __repr__(self) -> str:
        return f"<AuditLog id={self.id} action={self.action} resource_id={self.resource_id}>"
