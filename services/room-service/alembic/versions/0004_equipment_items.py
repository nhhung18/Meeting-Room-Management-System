"""add equipment_items and equipment_room_assignments tables

Revision ID: 0004
Revises: 0003c
Create Date: 2026-11-16
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "equipment_items",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.VARCHAR(255), nullable=False),
        sa.Column("category", sa.VARCHAR(100), nullable=False),
        sa.Column(
            "status",
            sa.VARCHAR(50),
            nullable=False,
            server_default="FUNCTIONAL",
        ),
        sa.Column("serial_number", sa.VARCHAR(255), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("ix_equipment_items_category", "equipment_items", ["category"])
    op.create_index("ix_equipment_items_status", "equipment_items", ["status"])
    op.create_index("ix_equipment_items_deleted_at", "equipment_items", ["deleted_at"])

    op.create_table(
        "equipment_room_assignments",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "equipment_id",
            sa.Integer,
            sa.ForeignKey("equipment_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "room_id",
            sa.Integer,
            sa.ForeignKey("rooms.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "assigned_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("equipment_id", "room_id", name="uq_equipment_room"),
    )
    op.create_index(
        "ix_equipment_room_assignments_equipment_id",
        "equipment_room_assignments",
        ["equipment_id"],
    )
    op.create_index(
        "ix_equipment_room_assignments_room_id",
        "equipment_room_assignments",
        ["room_id"],
    )


def downgrade() -> None:
    op.drop_table("equipment_room_assignments")
    op.drop_table("equipment_items")
