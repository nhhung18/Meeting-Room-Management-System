"""add outbox_events table and owner_email to rooms

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-11
"""

import sqlalchemy as sa

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "outbox_events",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("event_type", sa.VARCHAR(50), nullable=False),
        sa.Column("payload", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("sent_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("request_id", sa.VARCHAR(64), nullable=True),
    )
    op.create_index("ix_outbox_events_sent_at", "outbox_events", ["sent_at"])

    op.add_column("rooms", sa.Column("owner_email", sa.VARCHAR(255), nullable=True))


def downgrade() -> None:
    op.drop_column("rooms", "owner_email")
    op.drop_index("ix_outbox_events_sent_at", table_name="outbox_events")
    op.drop_table("outbox_events")
