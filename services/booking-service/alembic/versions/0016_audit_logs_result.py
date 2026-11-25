"""add result column to audit_logs

Revision ID: 0016
Revises: 0015
Create Date: 2026-11-26

FR-08: ghi kết quả hành động (SUCCESS / DENIED / FAILED) vào từng audit entry.
Giá trị mặc định SUCCESS để không ảnh hưởng các bản ghi cũ.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "audit_logs",
        sa.Column("result", sa.String(20), nullable=True, server_default="SUCCESS"),
    )


def downgrade() -> None:
    op.drop_column("audit_logs", "result")
