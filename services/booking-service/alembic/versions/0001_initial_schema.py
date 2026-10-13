"""initial schema: bookings, booking_attendees, room_snapshots

Revision ID: 0001
Revises:
Create Date: 2026-10-14

"""

from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: Any = None
branch_labels: Any = None
depends_on: Any = None


def upgrade() -> None:
    # btree_gist required for EXCLUDE USING gist on non-geometric types (room_id int + tstzrange)
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("room_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.VARCHAR(255), nullable=False),
        sa.Column("start_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("end_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column(
            "num_attendees",
            sa.Integer(),
            nullable=False,
            comment="CHECK num_attendees > 0 enforced below",
        ),
        sa.Column(
            "status",
            sa.VARCHAR(20),
            nullable=False,
            server_default="CONFIRMED",
        ),
        sa.Column("checked_in_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("auto_cancelled_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.CheckConstraint("num_attendees > 0", name="ck_bookings_num_attendees_positive"),
        sa.CheckConstraint(
            "status IN ('CONFIRMED', 'CHECKED_IN', 'CANCELLED')",
            name="ck_bookings_status",
        ),
    )

    # EXCLUDE constraint: prevent overlapping bookings on the same room.
    # Half-open [start, end) via tstzrange(..., '[)') — assumption #1 in docs/assumptions.md.
    # WHERE clause excludes CANCELLED so a cancelled booking does not block a new one.
    op.execute(
        """
        ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
        EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
        WHERE (status IN ('CONFIRMED', 'CHECKED_IN'))
        """
    )

    # Partial indexes: smaller, faster for their specific queries (see docs/erd.md §4)
    op.create_index(
        "idx_bookings_room_time",
        "bookings",
        ["room_id", "start_at", "end_at"],
        postgresql_where=sa.text("status IN ('CONFIRMED', 'CHECKED_IN')"),
    )
    op.create_index(
        "idx_bookings_user_created",
        "bookings",
        ["user_id", sa.text("created_at DESC")],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_bookings_auto_cancel",
        "bookings",
        ["status", "start_at"],
        postgresql_where=sa.text("status = 'CONFIRMED'"),
    )

    op.create_table(
        "booking_attendees",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "booking_id",
            sa.Integer(),
            sa.ForeignKey("bookings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("attendee_email", sa.VARCHAR(255), nullable=False),
        sa.Column("name", sa.VARCHAR(255), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("booking_id", "attendee_email", name="uq_booking_attendee"),
    )

    op.create_index("idx_booking_attendees_booking_id", "booking_attendees", ["booking_id"])
    op.create_index("idx_booking_attendees_email", "booking_attendees", ["attendee_email"])

    op.create_table(
        "room_snapshots",
        sa.Column("room_id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.VARCHAR(255), nullable=False),
        sa.Column(
            "capacity",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.VARCHAR(50),
            nullable=False,
            server_default="AVAILABLE",
        ),
        sa.Column(
            "equipment",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        # version: idempotency guard for event-driven snapshots (ADR-0003)
        sa.Column("version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "last_synced",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint("capacity > 0", name="ck_room_snapshots_capacity_positive"),
        sa.CheckConstraint(
            "status IN ('AVAILABLE', 'MAINTENANCE', 'ARCHIVED')",
            name="ck_room_snapshots_status",
        ),
    )

    op.create_index(
        "idx_room_snapshots_status_capacity",
        "room_snapshots",
        ["status", "capacity"],
        postgresql_where=sa.text("status = 'AVAILABLE'"),
    )


def downgrade() -> None:
    op.drop_table("room_snapshots")
    op.drop_table("booking_attendees")
    op.drop_table("bookings")
    # Not dropping btree_gist extension: it may be used by other objects
