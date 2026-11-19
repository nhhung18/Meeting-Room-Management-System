"""add audit_logs table

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-19

Bảng ghi lại mọi hành động quản trị: đặt phòng, quản lý user, chính sách.
Dữ liệu chỉ được thêm (append-only), không bao giờ xóa (audit trail).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("actor_id", sa.String(255), nullable=False),
        sa.Column("actor_name", sa.String(255), nullable=True),
        sa.Column("actor_role", sa.String(50), nullable=True),
        sa.Column("action_type", sa.String(60), nullable=False),
        sa.Column("target_id", sa.String(255), nullable=True),
        sa.Column("target_name", sa.String(255), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(50), nullable=True),
    )
    op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"])
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_action_type", "audit_logs", ["action_type"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_action_type", "audit_logs")
    op.drop_index("ix_audit_logs_actor_id", "audit_logs")
    op.drop_index("ix_audit_logs_timestamp", "audit_logs")
    op.drop_table("audit_logs")
