"""add floor to rooms

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-11
"""

import sqlalchemy as sa

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("rooms", sa.Column("floor", sa.VARCHAR(100), nullable=True))


def downgrade() -> None:
    op.drop_column("rooms", "floor")
