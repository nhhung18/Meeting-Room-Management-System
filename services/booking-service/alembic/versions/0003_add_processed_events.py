"""add processed_events for notification idempotency

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-27

processed_events: theo dõi event_id đã xử lý để tránh gửi email 2 lần
khi notification-worker nhận duplicate message từ RabbitMQ.
"""

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "processed_events",
        sa.Column("event_id", sa.VARCHAR(36), primary_key=True),
        sa.Column(
            "processed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("processed_events")
