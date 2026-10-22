"""add owner_id to room_snapshots

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-22

owner_id: Auth0 sub của Room Manager sở hữu phòng.
Dùng cho RBAC trong booking-service (Task 4): Room Manager chỉ thấy
bookings của phòng mình quản lý.
"""

from typing import Any

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: Any = "0001"
branch_labels: Any = None
depends_on: Any = None


def upgrade() -> None:
    op.add_column("room_snapshots", sa.Column("owner_id", sa.VARCHAR(255), nullable=True))


def downgrade() -> None:
    op.drop_column("room_snapshots", "owner_id")
