"""Equipment ORM models."""

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class EquipmentItem(Base):
    __tablename__ = "equipment_items"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(sa.VARCHAR(255), nullable=False)
    category: Mapped[str] = mapped_column(sa.VARCHAR(100), nullable=False)
    status: Mapped[str] = mapped_column(
        sa.VARCHAR(50), nullable=False, server_default="FUNCTIONAL"
    )
    serial_number: Mapped[str | None] = mapped_column(sa.VARCHAR(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")
    )
    updated_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")
    )
    deleted_at: Mapped[sa.DateTime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )

    assignments: Mapped[list["EquipmentRoomAssignment"]] = relationship(
        "EquipmentRoomAssignment",
        back_populates="equipment",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<EquipmentItem id={self.id} name={self.name!r} status={self.status}>"


class EquipmentRoomAssignment(Base):
    __tablename__ = "equipment_room_assignments"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    equipment_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("equipment_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    room_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("rooms.id", ondelete="CASCADE"),
        nullable=False,
    )
    assigned_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")
    )

    equipment: Mapped["EquipmentItem"] = relationship(
        "EquipmentItem", back_populates="assignments"
    )
