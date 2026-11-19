"""seed all booking policy keys

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-19

Seed các policy keys còn thiếu cho BookingPolicyConfig mà frontend cần.
check_in_window_minutes đã có từ 0005, không insert lại.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0010"
down_revision: str | Sequence[str] | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_NEW_POLICIES = [
    ("max_advance_days", "14", "Số ngày tối đa đặt trước (mặc định 14 ngày)"),
    ("max_duration_minutes", "180", "Thời lượng tối đa một cuộc họp (phút, mặc định 180)"),
    ("min_duration_minutes", "15", "Thời lượng tối thiểu một cuộc họp (phút, mặc định 15)"),
    ("enable_auto_release_no_show", "true", "Tự động hủy booking khi không check-in đúng hạn"),
    ("auto_release_grace_minutes", "15", "Số phút sau start_at mà không check-in thì tự hủy"),
    ("buffer_minutes_between_meetings", "0", "Thời gian đệm giữa hai cuộc họp liên tiếp (phút)"),
    ("min_cancel_notice_minutes", "30", "Số phút tối thiểu phải báo trước khi hủy booking"),
]


def upgrade() -> None:
    for key, value, description in _NEW_POLICIES:
        op.execute(
            f"""
            INSERT INTO system_policies (key, value, description)
            VALUES ('{key}', '{value}'::jsonb, '{description}')
            ON CONFLICT (key) DO NOTHING
            """
        )


def downgrade() -> None:
    keys = ", ".join(f"'{k}'" for k, _, _ in _NEW_POLICIES)
    op.execute(f"DELETE FROM system_policies WHERE key IN ({keys})")
