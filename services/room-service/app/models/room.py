"""Room ORM model (tương đương @Entity trong JPA).

Map tới bảng `rooms` trong room_db.
Equipment lưu dạng JSONB array of strings — không tách bảng riêng (xem docs/erd.md §4).
Soft delete qua cột nullable `deleted_at`.
"""

import enum

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class RoomStatus(enum.StrEnum):
    """Ba trạng thái vòng đời của phòng họp.

    StrEnum (Python 3.11+) kế thừa str — Pydantic serialize/deserialize tự nhiên.
    Dùng trong schemas để validate; cột DB giữ nguyên VARCHAR + CHECK constraint.
    """

    AVAILABLE = "AVAILABLE"
    MAINTENANCE = "MAINTENANCE"
    ARCHIVED = "ARCHIVED"


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(sa.VARCHAR(255), nullable=False)
    capacity: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        sa.VARCHAR(50),
        nullable=False,
        server_default="AVAILABLE",
    )
    equipment: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        server_default=sa.text("'[]'::jsonb"),
    )
    owner_id: Mapped[str | None] = mapped_column(sa.VARCHAR(255), nullable=True)
    created_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    updated_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    deleted_at: Mapped[sa.DateTime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=True,
    )

    def __repr__(self) -> str:
        return f"<Room id={self.id} name={self.name!r} status={self.status}>"
