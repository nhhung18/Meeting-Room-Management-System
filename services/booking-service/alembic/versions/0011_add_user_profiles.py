"""add user_profiles table

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-19

Bảng lưu profile người dùng local (phương án 3: Auth0 login, local DB RBAC).
sub từ JWT (Auth0) là primary key.
JIT provisioning khi user đăng nhập lần đầu.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011"
down_revision: str | Sequence[str] | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_profiles",
        sa.Column("id", sa.VARCHAR(255), primary_key=True),  # Auth0 sub
        sa.Column("email", sa.VARCHAR(255), nullable=False, unique=True),
        sa.Column("name", sa.VARCHAR(255), nullable=False),
        sa.Column("role", sa.VARCHAR(50), nullable=False, server_default="EMPLOYEE"),
        sa.Column("status", sa.VARCHAR(20), nullable=False, server_default="ACTIVE"),
        sa.Column("department", sa.VARCHAR(255), nullable=True),
        sa.Column("phone", sa.VARCHAR(50), nullable=True),
        sa.Column("avatar", sa.Text(), nullable=True),
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
            onupdate=sa.text("now()"),
        ),
    )
    op.create_index("ix_user_profiles_email", "user_profiles", ["email"])
    op.create_index("ix_user_profiles_role", "user_profiles", ["role"])


def downgrade() -> None:
    op.drop_index("ix_user_profiles_role", table_name="user_profiles")
    op.drop_index("ix_user_profiles_email", table_name="user_profiles")
    op.drop_table("user_profiles")
