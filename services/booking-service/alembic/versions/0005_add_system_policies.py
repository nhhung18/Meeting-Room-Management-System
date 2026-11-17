"""add system_policies table for runtime configuration

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-11

Bảng policy cho phép Admin điều chỉnh các tham số vận hành qua API
mà không cần restart service (FR-05-4). Giá trị mặc định check-in window = 15 phút.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "system_policies",
        sa.Column("key", sa.VARCHAR(50), primary_key=True),
        sa.Column("value", JSONB(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("updated_by", sa.VARCHAR(255), nullable=True),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # Seed default policy
    op.execute(
        """
        INSERT INTO system_policies (key, value, description)
        VALUES (
            'check_in_window_minutes',
            '15'::jsonb,
            'Cửa sổ check-in (phút) mở trước start_at và đóng sau start_at.'
        )
        """
    )


def downgrade() -> None:
    op.drop_table("system_policies")
