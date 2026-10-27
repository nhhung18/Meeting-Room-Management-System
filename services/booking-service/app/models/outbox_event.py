"""OutboxEvent ORM model — transactional outbox pattern.

Events are written to this table in the same DB transaction as the booking mutation.
A relay worker polls unsent rows and publishes them to RabbitMQ.
"""

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class OutboxEvent(Base):
    __tablename__ = "outbox_events"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(sa.VARCHAR(50), nullable=False)
    payload: Mapped[str] = mapped_column(sa.Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    sent_at: Mapped[datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )
    request_id: Mapped[str | None] = mapped_column(sa.VARCHAR(64), nullable=True)
