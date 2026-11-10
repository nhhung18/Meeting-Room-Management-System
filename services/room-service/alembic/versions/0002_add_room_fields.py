"""add floor, description, image_url to rooms

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-10

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("rooms", sa.Column("floor", sa.VARCHAR(100), nullable=True))
    op.add_column("rooms", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("rooms", sa.Column("image_url", sa.VARCHAR(500), nullable=True))


def downgrade() -> None:
    op.drop_column("rooms", "image_url")
    op.drop_column("rooms", "description")
    op.drop_column("rooms", "floor")
