"""RoomSnapshot ORM model — local copy của room data (ADR-0003).

Booking service lưu bản sao tối thiểu của phòng để:
- Tránh gọi Room Service mỗi request (performance).
- Vẫn hoạt động khi Room Service down (resilience).

owner_id: Auth0 sub của Room Manager sở hữu phòng, dùng cho RBAC.
version: idempotency guard — chỉ update khi event.version > stored version.
"""

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class RoomSnapshot(Base):
    __tablename__ = "room_snapshots"

    room_id: Mapped[int] = mapped_column(sa.Integer, primary_key=True)
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
    version: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default="0")
    last_synced: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )

    def __repr__(self) -> str:
        return f"<RoomSnapshot room_id={self.room_id} name={self.name!r} status={self.status}>"
