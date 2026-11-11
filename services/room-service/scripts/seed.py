"""Seed script: inserts demo rooms into room_db. Idempotent — safe to run multiple times."""

import json

from sqlalchemy import Engine, text

from app.db.session import get_engine

SEED_ROOMS: list[dict] = [
    {
        "name": "P101 - Phòng họp nhỏ A",
        "capacity": 4,
        "status": "AVAILABLE",
        "floor": "Tầng 1",
        "equipment": ["whiteboard"],
    },
    {
        "name": "P102 - Phòng họp nhỏ B",
        "capacity": 6,
        "status": "AVAILABLE",
        "floor": "Tầng 1",
        "equipment": ["whiteboard", "tv"],
    },
    {
        "name": "P201 - Phòng họp vừa A",
        "capacity": 10,
        "status": "AVAILABLE",
        "floor": "Tầng 2",
        "equipment": ["projector", "whiteboard", "webcam"],
    },
    {
        "name": "P202 - Phòng họp vừa B",
        "capacity": 12,
        "status": "AVAILABLE",
        "floor": "Tầng 2",
        "equipment": ["projector", "whiteboard", "webcam", "speaker"],
    },
    {
        "name": "P301 - Phòng họp lớn",
        "capacity": 20,
        "status": "AVAILABLE",
        "floor": "Tầng 3",
        "equipment": ["projector", "whiteboard", "webcam", "speaker", "microphone"],
    },
    {
        "name": "P302 - Phòng đào tạo",
        "capacity": 30,
        "status": "AVAILABLE",
        "floor": "Tầng 3",
        "equipment": ["projector", "whiteboard", "webcam", "speaker", "microphone"],
    },
    {
        "name": "P401 - Boardroom",
        "capacity": 16,
        "status": "AVAILABLE",
        "floor": "Tầng 4",
        "equipment": ["projector", "webcam", "speaker", "microphone", "tv"],
    },
    {
        "name": "P402 - Phòng phỏng vấn",
        "capacity": 4,
        "status": "AVAILABLE",
        "floor": "Tầng 4",
        "equipment": ["webcam"],
    },
    {
        "name": "P501 - Hội trường",
        "capacity": 50,
        "status": "AVAILABLE",
        "floor": "Tầng 5",
        "equipment": ["projector", "speaker", "microphone"],
    },
    {
        "name": "P103 - Phòng brainstorm",
        "capacity": 8,
        "status": "AVAILABLE",
        "floor": "Tầng 1",
        "equipment": ["whiteboard", "tv"],
    },
    {
        "name": "P203 - Phòng bảo trì",
        "capacity": 10,
        "status": "MAINTENANCE",
        "floor": "Tầng 2",
        "equipment": ["projector"],
    },
]


INSERT_ROOM_SQL = text(
    """
    INSERT INTO rooms (name, capacity, status, floor, equipment)
    VALUES (:name, :capacity, :status, :floor, CAST(:equipment AS jsonb))
    ON CONFLICT (name) WHERE deleted_at IS NULL DO NOTHING
    """
)


def seed(engine: Engine) -> int:
    """Insert SEED_ROOMS into rooms table. Returns the number of rows actually inserted."""
    inserted = 0
    with engine.begin() as conn:
        for room in SEED_ROOMS:
            result = conn.execute(
                INSERT_ROOM_SQL,
                {
                    "name": room["name"],
                    "capacity": room["capacity"],
                    "status": room["status"],
                    "floor": room.get("floor"),
                    "equipment": json.dumps(room["equipment"]),
                },
            )
            inserted += result.rowcount
    return inserted


def main() -> None:
    inserted = seed(get_engine())
    skipped = len(SEED_ROOMS) - inserted
    print(f"Seeded {inserted} rooms ({skipped} skipped)")


if __name__ == "__main__":
    main()
