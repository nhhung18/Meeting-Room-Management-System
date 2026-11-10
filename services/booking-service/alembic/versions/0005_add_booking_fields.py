"""add purpose, description, meeting_type, meeting_link to bookings

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-10

"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # purpose: NOT NULL với server_default tạm thời để migrate data hiện tại (nếu có)
    op.add_column(
        "bookings",
        sa.Column(
            "purpose",
            sa.VARCHAR(255),
            nullable=False,
            server_default="(no title)",
        ),
    )
    # Xóa server_default sau khi thêm cột để ép buộc client luôn cung cấp giá trị
    op.alter_column("bookings", "purpose", server_default=None)

    op.add_column("bookings", sa.Column("description", sa.Text(), nullable=True))
    op.add_column(
        "bookings",
        sa.Column(
            "meeting_type",
            sa.VARCHAR(20),
            nullable=False,
            server_default="OFFLINE",
        ),
    )
    op.alter_column("bookings", "meeting_type", server_default=None)
    op.add_column("bookings", sa.Column("meeting_link", sa.VARCHAR(500), nullable=True))


def downgrade() -> None:
    op.drop_column("bookings", "meeting_link")
    op.drop_column("bookings", "meeting_type")
    op.drop_column("bookings", "description")
    op.drop_column("bookings", "purpose")
