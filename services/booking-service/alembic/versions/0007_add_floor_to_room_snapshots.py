"""add floor to room_snapshots

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-11
"""

import sqlalchemy as sa

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("room_snapshots", sa.Column("floor", sa.VARCHAR(100), nullable=True))


def downgrade() -> None:
    op.drop_column("room_snapshots", "floor")
