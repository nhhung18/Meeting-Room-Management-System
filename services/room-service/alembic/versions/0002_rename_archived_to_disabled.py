"""rename ARCHIVED status to DISABLED

Revision ID: 0003b
Revises: 0003
Create Date: 2026-11-11

Requirement ghi trạng thái là "Disabled" (FR-02-4).
Migration này:
  1. Đổi data hiện có ARCHIVED → DISABLED
  2. DROP constraint cũ ck_rooms_status
  3. ADD constraint mới với DISABLED thay ARCHIVED
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003b"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Migrate existing data first
    op.execute("UPDATE rooms SET status = 'DISABLED' WHERE status = 'ARCHIVED'")

    # Replace CHECK constraint
    op.drop_constraint("ck_rooms_status", "rooms", type_="check")
    op.create_check_constraint(
        "ck_rooms_status",
        "rooms",
        "status IN ('AVAILABLE', 'MAINTENANCE', 'DISABLED')",
    )


def downgrade() -> None:
    op.execute("UPDATE rooms SET status = 'ARCHIVED' WHERE status = 'DISABLED'")

    op.drop_constraint("ck_rooms_status", "rooms", type_="check")
    op.create_check_constraint(
        "ck_rooms_status",
        "rooms",
        "status IN ('AVAILABLE', 'MAINTENANCE', 'ARCHIVED')",
    )
