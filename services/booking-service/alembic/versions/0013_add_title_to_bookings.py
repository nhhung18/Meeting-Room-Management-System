"""add title to bookings

Revision ID: 0013
Revises: 0012
Create Date: 2026-11-19

Thêm cột title (tiêu đề cuộc họp) vào bảng bookings.
purpose vẫn giữ nguyên để lưu nội dung/mô tả chi tiết.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "bookings",
        sa.Column("title", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("bookings", "title")
