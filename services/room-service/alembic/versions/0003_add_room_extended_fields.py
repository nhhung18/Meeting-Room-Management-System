"""add description and image_url to rooms

Revision ID: 0003c
Revises: 0003b
Create Date: 2026-11-11

Thêm các trường mở rộng cho phòng họp (floor đã có từ 0003):
- description: mô tả chi tiết (Text)
- image_url: URL ảnh phòng từ Cloudinary (VARCHAR 500)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003c"
down_revision: str | Sequence[str] | None = "0003b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("rooms", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("rooms", sa.Column("image_url", sa.VARCHAR(500), nullable=True))


def downgrade() -> None:
    op.drop_column("rooms", "image_url")
    op.drop_column("rooms", "description")
