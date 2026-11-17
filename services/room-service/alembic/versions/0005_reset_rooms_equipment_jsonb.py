"""reset rooms.equipment JSONB to empty array

equipment_items table is now the source of truth.
rooms.equipment was populated with mock category strings;
_sync_room_equipment_jsonb() will repopulate it whenever equipment
is assigned/removed via the API.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-17
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE rooms SET equipment = '[]'::jsonb")


def downgrade() -> None:
    # Data is unrecoverable after reset; downgrade is a no-op.
    pass
