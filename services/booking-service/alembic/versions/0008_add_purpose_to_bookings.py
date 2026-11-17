"""add purpose to bookings

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0008'
down_revision: Union[str, Sequence[str], None] = '0007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('bookings', sa.Column('purpose', sa.VARCHAR(500), nullable=True))


def downgrade() -> None:
    op.drop_column('bookings', 'purpose')
