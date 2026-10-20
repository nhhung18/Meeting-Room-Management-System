"""initial schema: rooms table

Revision ID: 0001
Revises:
Create Date: 2026-10-20

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create rooms table with constraints and indexes."""
    op.create_table(
        "rooms",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.VARCHAR(255), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("status", sa.VARCHAR(50), nullable=False, server_default="AVAILABLE"),
        sa.Column("equipment", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("owner_id", sa.VARCHAR(255), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("capacity > 0", name="ck_rooms_capacity_positive"),
        sa.CheckConstraint(
            "status IN ('AVAILABLE', 'MAINTENANCE', 'ARCHIVED')", name="ck_rooms_status"
        ),
    )

    # Partial unique index: two active rooms cannot share a name; soft-deleted names are reusable
    op.execute("CREATE UNIQUE INDEX uq_rooms_name_active ON rooms (name) WHERE deleted_at IS NULL")

    # Performance indexes
    op.create_index(
        "idx_rooms_status",
        "rooms",
        ["status"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_rooms_owner_id",
        "rooms",
        ["owner_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    """Drop rooms table and all associated indexes."""
    op.drop_index("idx_rooms_owner_id", table_name="rooms")
    op.drop_index("idx_rooms_status", table_name="rooms")
    op.execute("DROP INDEX IF EXISTS uq_rooms_name_active")
    op.drop_table("rooms")
