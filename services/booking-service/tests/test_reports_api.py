"""Unit tests phân quyền cho /reports/stats — DB mock, logic aggregate nằm ở integration tests."""

import pytest

URL = "/api/bookings/reports/stats"
PARAMS = {"start_date": "2026-11-01", "end_date": "2026-11-30"}


@pytest.fixture(autouse=True)
def _empty_db(mock_db):
    # Kỳ không có dữ liệu: mọi aggregate trả rỗng / 0
    mock_db.execute.return_value.all.return_value = []
    mock_db.scalar.return_value = 0


class TestReportStatsAccess:
    def test_admin_can_read(self, client, admin_user):
        assert client.get(URL, params=PARAMS).status_code == 200

    def test_room_manager_can_read(self, client, manager_user):
        # Regression: trước đây require_admin khiến manager nhận 403 và dashboard trắng
        assert client.get(URL, params=PARAMS).status_code == 200

    def test_employee_forbidden(self, client, employee_user):
        assert client.get(URL, params=PARAMS).status_code == 403

    def test_unauthenticated_401(self, client, auth_required):
        assert client.get(URL, params=PARAMS).status_code == 401


def test_empty_period_returns_zeroed_new_fields(client, admin_user):
    body = client.get(URL, params=PARAMS).json()
    assert body["auto_cancelled"] == 0
    assert body["monthly_stats"] == []
    assert body["room_utilisation"] == []
