"""add audit_logs table

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-10

"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("actor_id", sa.VARCHAR(255), nullable=False),
        sa.Column("actor_roles", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("action", sa.VARCHAR(50), nullable=False),
        sa.Column(
            "resource_type",
            sa.VARCHAR(50),
            nullable=False,
            server_default=sa.text("'booking'"),
        ),
        sa.Column("resource_id", sa.Integer, nullable=False),
        sa.Column("before_snapshot", JSONB, nullable=True),
        sa.Column("after_snapshot", JSONB, nullable=True),
        sa.Column("request_id", sa.VARCHAR(255), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_audit_logs_resource_id", "audit_logs", ["resource_id"])
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_created_at")
    op.drop_index("ix_audit_logs_actor_id")
    op.drop_index("ix_audit_logs_resource_id")
    op.drop_table("audit_logs")
