"""add floor, description, image_url to rooms

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-11

Thêm các trường mở rộng cho phòng họp:
- floor: tầng (VARCHAR 100)
- description: mô tả chi tiết (Text)
- image_url: URL ảnh phòng từ Cloudinary (VARCHAR 500)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
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
