"""Unit tests cho room image upload endpoint (FR-02-6).

Cloudinary được mock hoàn toàn — không cần key thật để chạy tests.
"""

import io
from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest

from app.api.room_image import _get_service
from app.main import app
from app.schemas.room import RoomResponse
from app.services.room_service import RoomService


def _room_response(**overrides) -> RoomResponse:
    defaults = {
        "id": 1,
        "name": "P101",
        "capacity": 10,
        "status": "AVAILABLE",
        "equipment": [],
        "owner_id": None,
        "image_url": "https://res.cloudinary.com/demo/image/upload/rooms/1.jpg",
        "created_at": datetime(2026, 1, 1, tzinfo=UTC),
        "updated_at": datetime(2026, 1, 1, tzinfo=UTC),
    }
    defaults.update(overrides)
    return RoomResponse(**defaults)


@pytest.fixture
def mock_service():
    svc = MagicMock(spec=RoomService)
    app.dependency_overrides[_get_service] = lambda: svc
    yield svc
    app.dependency_overrides.pop(_get_service, None)


FAKE_IMAGE = b"\xff\xd8\xff\xe0" + b"\x00" * 100  # minimal JPEG magic bytes


class TestUploadRoomImage:
    def test_upload_success_200(self, client, manager_user, mock_service):
        mock_service.upload_image.return_value = _room_response()
        resp = client.post(
            "/api/rooms/1/image",
            files={"file": ("photo.jpg", io.BytesIO(FAKE_IMAGE), "image/jpeg")},
        )
        assert resp.status_code == 200
        assert resp.json()["image_url"] is not None
        mock_service.upload_image.assert_called_once()

    def test_upload_invalid_file_type_422(self, client, manager_user):
        resp = client.post(
            "/api/rooms/1/image",
            files={"file": ("doc.pdf", io.BytesIO(b"%PDF"), "application/pdf")},
        )
        assert resp.status_code == 422

    def test_upload_too_large_413(self, client, manager_user):
        big_file = b"\xff\xd8\xff" + b"\x00" * (5 * 1024 * 1024 + 1)
        resp = client.post(
            "/api/rooms/1/image",
            files={"file": ("big.jpg", io.BytesIO(big_file), "image/jpeg")},
        )
        assert resp.status_code == 413

    def test_upload_room_not_found_404(self, client, manager_user, mock_service):
        mock_service.upload_image.side_effect = RoomService.NotFoundError("not found")
        resp = client.post(
            "/api/rooms/999/image",
            files={"file": ("photo.jpg", io.BytesIO(FAKE_IMAGE), "image/jpeg")},
        )
        assert resp.status_code == 404

    def test_upload_cloudinary_error_502(self, client, manager_user, mock_service):
        mock_service.upload_image.side_effect = RoomService.CloudinaryError("upload failed")
        resp = client.post(
            "/api/rooms/1/image",
            files={"file": ("photo.jpg", io.BytesIO(FAKE_IMAGE), "image/jpeg")},
        )
        assert resp.status_code == 502

