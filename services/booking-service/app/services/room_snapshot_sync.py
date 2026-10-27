"""RoomSnapshotSync — pulls room data from room-service HTTP API (ADR-0003).

Calls GET /api/rooms/ on room-service, then upserts each room into the local
room_snapshots table via RoomSnapshotRepository. The version guard in the repo
ensures idempotency: stale events are silently skipped.
"""

import uuid

import httpx

from app.repositories.room_snapshot_repository import RoomSnapshotRepository


class RoomSnapshotSync:
    def __init__(self, snapshot_repo: RoomSnapshotRepository, room_service_url: str) -> None:
        self._repo = snapshot_repo
        self._base_url = room_service_url.rstrip("/")

    def sync_from_room_service(self) -> int:
        """Fetch all rooms from room-service and upsert snapshots locally.

        Returns the number of rooms actually written (skips stale versions).
        Returns 0 and logs nothing if room-service is unreachable.
        """
        try:
            with httpx.Client() as client:
                response = client.get(
                    f"{self._base_url}/api/rooms/",
                    headers={"X-Request-ID": str(uuid.uuid4())},
                )
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPError:
            return 0

        count = 0
        for room in data.get("items", []):
            result = self._repo.upsert(
                room_id=room["id"],
                name=room["name"],
                capacity=room["capacity"],
                status=room["status"],
                equipment=room.get("equipment", []),
                owner_id=room.get("owner_id"),
                version=room["version"],
            )
            if result is not None:
                count += 1

        return count
