"""add meeting_type and meeting_link to bookings

Revision ID: 0015
Revises: 0014
Create Date: 2026-11-20

FR-04: cuộc họp online/offline/hybrid + link họp online
"""

from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "bookings",
        sa.Column(
            "meeting_type",
            sa.VARCHAR(10),
            nullable=False,
            server_default="OFFLINE",
        ),
    )
    op.add_column(
        "bookings",
        sa.Column("meeting_link", sa.VARCHAR(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("bookings", "meeting_link")
    op.drop_column("bookings", "meeting_type")
