"""Unit tests for RoomSnapshotSync — httpx and repo both mocked."""

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.repositories.room_snapshot_repository import RoomSnapshotRepository
from app.services.room_snapshot_sync import RoomSnapshotSync


@pytest.fixture
def mock_snapshot_repo() -> MagicMock:
    return MagicMock(spec=RoomSnapshotRepository)


@pytest.fixture
def sync_service(mock_snapshot_repo) -> RoomSnapshotSync:
    return RoomSnapshotSync(mock_snapshot_repo, "http://room-service:8000")


_ROOM_PAYLOAD = {
    "items": [
        {
            "id": 1,
            "name": "Room A",
            "capacity": 10,
            "status": "AVAILABLE",
            "equipment": ["projector"],
            "owner_id": "owner-1",
            "version": 2,
        }
    ]
}


class TestSyncFromRoomService:
    def test_syncs_rooms_and_returns_count(self, sync_service, mock_snapshot_repo):
        mock_snapshot_repo.upsert.return_value = MagicMock()  # non-None → counted

        with patch("httpx.Client") as mock_client_cls:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = _ROOM_PAYLOAD
            mock_client_cls.return_value.__enter__.return_value.get.return_value = mock_response

            count = sync_service.sync_from_room_service()

        assert count == 1
        mock_snapshot_repo.upsert.assert_called_once_with(
            room_id=1,
            name="Room A",
            capacity=10,
            status="AVAILABLE",
            equipment=["projector"],
            owner_id="owner-1",
            version=2,
        )

    def test_skips_stale_version(self, sync_service, mock_snapshot_repo):
        mock_snapshot_repo.upsert.return_value = None  # version guard → skipped

        with patch("httpx.Client") as mock_client_cls:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = _ROOM_PAYLOAD
            mock_client_cls.return_value.__enter__.return_value.get.return_value = mock_response

            count = sync_service.sync_from_room_service()

        assert count == 0

    def test_handles_room_service_down(self, sync_service):
        with patch("httpx.Client") as mock_client_cls:
            mock_client_cls.return_value.__enter__.return_value.get.side_effect = (
                httpx.ConnectError("connection refused")
            )

            # Should not raise — returns 0 gracefully
            count = sync_service.sync_from_room_service()

        assert count == 0

    def test_passes_request_id_header(self, sync_service, mock_snapshot_repo):
        mock_snapshot_repo.upsert.return_value = MagicMock()

        with patch("httpx.Client") as mock_client_cls:
            mock_get = mock_client_cls.return_value.__enter__.return_value.get
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = _ROOM_PAYLOAD
            mock_get.return_value = mock_response

            sync_service.sync_from_room_service()

            call_kwargs = mock_get.call_args.kwargs
            headers = call_kwargs.get("headers", {})
            assert "X-Request-ID" in headers
