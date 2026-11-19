"""add request_id to audit_logs

Revision ID: 0014
Revises: 0013
Create Date: 2026-11-19

Thêm request_id vào audit_logs để liên kết với correlation ID của từng request.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "audit_logs",
        sa.Column("request_id", sa.String(36), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("audit_logs", "request_id")
