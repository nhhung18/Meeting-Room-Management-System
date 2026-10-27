"""add outbox_events for transactional outbox pattern

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-27

outbox_events: ghi event vào cùng transaction với booking mutation.
Relay worker poll sent_at IS NULL và publish lên RabbitMQ.
"""

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
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
    # partial index for relay worker to quickly find unsent events
    op.create_index(
        "ix_outbox_unsent",
        "outbox_events",
        ["created_at"],
        postgresql_where=sa.text("sent_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_outbox_unsent", table_name="outbox_events")
    op.drop_table("outbox_events")
