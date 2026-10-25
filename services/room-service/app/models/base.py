"""SQLAlchemy DeclarativeBase cho room-service.

Đây là Base duy nhất — tất cả ORM models kế thừa từ đây.
Alembic env.py import Base.metadata để hỗ trợ autogenerate revision.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
