"""SystemPolicy ORM model — cấu hình runtime do Admin điều chỉnh qua API.

Mỗi dòng là một policy key-value. value lưu dạng JSONB để linh hoạt
(int, string, nested object). Hiện tại chỉ có `check_in_window_minutes`.
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SystemPolicy(Base):
    __tablename__ = "system_policies"

    key: Mapped[str] = mapped_column(sa.VARCHAR(50), primary_key=True)
    value: Mapped[dict | list | int | str] = mapped_column(JSONB, nullable=False)
    description: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    updated_by: Mapped[str | None] = mapped_column(sa.VARCHAR(255), nullable=True)
    updated_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )

    def __repr__(self) -> str:
        return f"<SystemPolicy {self.key}={self.value!r}>"
