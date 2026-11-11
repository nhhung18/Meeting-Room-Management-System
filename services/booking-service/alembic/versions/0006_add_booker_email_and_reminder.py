"""add booker_email and reminder_sent_at to bookings

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-11
"""

import sqlalchemy as sa

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bookings", sa.Column("booker_email", sa.VARCHAR(255), nullable=True))
    op.add_column(
        "bookings",
        sa.Column("reminder_sent_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("bookings", "reminder_sent_at")
    op.drop_column("bookings", "booker_email")
