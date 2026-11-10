"""rename ARCHIVED status to DISABLED in room_snapshots

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-11

Đồng bộ với room-service migration 0002: đổi trạng thái ARCHIVED → DISABLED
trong bảng room_snapshots (bản sao của Room data trong booking_db).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE room_snapshots SET status = 'DISABLED' WHERE status = 'ARCHIVED'")

    op.drop_constraint("ck_room_snapshots_status", "room_snapshots", type_="check")
    op.create_check_constraint(
        "ck_room_snapshots_status",
        "room_snapshots",
        "status IN ('AVAILABLE', 'MAINTENANCE', 'DISABLED')",
    )


def downgrade() -> None:
    op.execute("UPDATE room_snapshots SET status = 'ARCHIVED' WHERE status = 'DISABLED'")

    op.drop_constraint("ck_room_snapshots_status", "room_snapshots", type_="check")
    op.create_check_constraint(
        "ck_room_snapshots_status",
        "room_snapshots",
        "status IN ('AVAILABLE', 'MAINTENANCE', 'ARCHIVED')",
    )
