"""UserProfile ORM model — profile người dùng local (phương án 3: Auth0 login, local DB RBAC).

id = Auth0 sub claim (ví dụ 'auth0|abc123' hoặc 'anonymous' khi dev mode).
"""

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[str] = mapped_column(sa.VARCHAR(255), primary_key=True)
    email: Mapped[str] = mapped_column(sa.VARCHAR(255), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(sa.VARCHAR(255), nullable=False)
    role: Mapped[str] = mapped_column(sa.VARCHAR(50), nullable=False, default="EMPLOYEE")
    status: Mapped[str] = mapped_column(sa.VARCHAR(20), nullable=False, default="ACTIVE")
    department: Mapped[str | None] = mapped_column(sa.VARCHAR(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(sa.VARCHAR(50), nullable=True)
    avatar: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")
    )
    updated_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")
    )

    def __repr__(self) -> str:
        return f"<UserProfile {self.id} {self.email} role={self.role}>"
