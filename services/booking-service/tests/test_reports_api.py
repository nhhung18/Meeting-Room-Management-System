"""Unit tests cho Reports API — service mocked, no DB."""

import pytest

from app.main import app
from app.schemas.booking import HourlyCount, ReportSummaryResponse, RoomBookingCount


def _mock_report(**kwargs) -> ReportSummaryResponse:
    defaults = dict(
        total_bookings=10,
        confirmed_bookings=6,
        cancelled_bookings=3,
        checked_in_bookings=1,
        most_booked_rooms=[RoomBookingCount(room_id=1, room_name="Room A", count=5)],
        busiest_hours=[HourlyCount(hour=9, count=4)],
    )
    defaults.update(kwargs)
    return ReportSummaryResponse(**defaults)


@pytest.fixture(autouse=True)
def _mock_db(mock_db):
    pass


@pytest.fixture
def mock_service(mock_booking_service):
    from app.api import reports as reports_module

    app.dependency_overrides[reports_module._get_booking_service] = (
        lambda db=None: mock_booking_service
    )
    yield mock_booking_service
    app.dependency_overrides.pop(reports_module._get_booking_service, None)


class TestReportSummary:
    def test_summary_returns_200(self, client, admin_user, mock_service):
        mock_service.get_report.return_value = _mock_report()
        resp = client.get("/api/bookings/reports/summary")
        assert resp.status_code == 200

    def test_summary_shape(self, client, admin_user, mock_service):
        mock_service.get_report.return_value = _mock_report()
        resp = client.get("/api/bookings/reports/summary")
        data = resp.json()
        assert "total_bookings" in data
        assert "confirmed_bookings" in data
        assert "cancelled_bookings" in data
        assert "checked_in_bookings" in data
        assert "most_booked_rooms" in data
        assert "busiest_hours" in data

    def test_summary_values(self, client, admin_user, mock_service):
        mock_service.get_report.return_value = _mock_report(
            total_bookings=20, confirmed_bookings=15
        )
        resp = client.get("/api/bookings/reports/summary")
        data = resp.json()
        assert data["total_bookings"] == 20
        assert data["confirmed_bookings"] == 15

    def test_summary_requires_admin(self, client, employee_user, mock_service):
        mock_service.get_report.return_value = _mock_report()
        resp = client.get("/api/bookings/reports/summary")
        assert resp.status_code == 403

    def test_summary_passes_period_params(self, client, admin_user, mock_service):
        mock_service.get_report.return_value = _mock_report()
        resp = client.get(
            "/api/bookings/reports/summary"
            "?period_start=2026-11-01T00:00:00%2B00:00"
            "&period_end=2026-11-30T23:59:59%2B00:00"
            "&top_n=3"
        )
        assert resp.status_code == 200
        mock_service.get_report.assert_called_once()
        call_kwargs = mock_service.get_report.call_args.kwargs
        assert call_kwargs["top_n"] == 3
