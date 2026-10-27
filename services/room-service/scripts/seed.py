"""Seed script: inserts demo rooms into room_db. Idempotent — safe to run multiple times."""

import json
import os

SEED_ROOMS: list[dict] = [
    {
        "name": "P101 - Phòng họp nhỏ A",
        "capacity": 4,
        "status": "AVAILABLE",
        "equipment": ["whiteboard"],
    },
    {
        "name": "P102 - Phòng họp nhỏ B",
        "capacity": 6,
        "status": "AVAILABLE",
        "equipment": ["whiteboard", "tv"],
    },
    {
        "name": "P201 - Phòng họp vừa A",
        "capacity": 10,
        "status": "AVAILABLE",
        "equipment": ["projector", "whiteboard", "webcam"],
    },
    {
        "name": "P202 - Phòng họp vừa B",
        "capacity": 12,
        "status": "AVAILABLE",
        "equipment": ["projector", "whiteboard", "webcam", "speaker"],
    },
    {
        "name": "P301 - Phòng họp lớn",
        "capacity": 20,
        "status": "AVAILABLE",
        "equipment": ["projector", "whiteboard", "webcam", "speaker", "microphone"],
    },
    {
        "name": "P302 - Phòng đào tạo",
        "capacity": 30,
        "status": "AVAILABLE",
        "equipment": ["projector", "whiteboard", "webcam", "speaker", "microphone"],
    },
    {
        "name": "P401 - Boardroom",
        "capacity": 16,
        "status": "AVAILABLE",
        "equipment": ["projector", "webcam", "speaker", "microphone", "tv"],
    },
    {
        "name": "P402 - Phòng phỏng vấn",
        "capacity": 4,
        "status": "AVAILABLE",
        "equipment": ["webcam"],
    },
    {
        "name": "P501 - Hội trường",
        "capacity": 50,
        "status": "AVAILABLE",
        "equipment": ["projector", "speaker", "microphone"],
    },
    {
        "name": "P103 - Phòng brainstorm",
        "capacity": 8,
        "status": "AVAILABLE",
        "equipment": ["whiteboard", "tv"],
    },
    {
        "name": "P203 - Phòng bảo trì",
        "capacity": 10,
        "status": "MAINTENANCE",
        "equipment": ["projector"],
    },
]


def seed(conn) -> int:  # conn: psycopg.Connection
    """Insert SEED_ROOMS into rooms table. Returns the number of rows actually inserted."""
    inserted = 0
    with conn.cursor() as cur:
        for room in SEED_ROOMS:
            cur.execute(
                """
                INSERT INTO rooms (name, capacity, status, equipment)
                VALUES (%s, %s, %s, %s::jsonb)
                ON CONFLICT (name) WHERE deleted_at IS NULL DO NOTHING
                """,
                (room["name"], room["capacity"], room["status"], json.dumps(room["equipment"])),
            )
            inserted += cur.rowcount
    conn.commit()
    return inserted


def main() -> None:
    import psycopg  # noqa: PLC0415 — deferred to keep SEED_ROOMS importable without psycopg installed

    database_url = os.environ["DATABASE_URL"]
    with psycopg.connect(database_url) as conn:
        inserted = seed(conn)
        skipped = len(SEED_ROOMS) - inserted
        print(f"Seeded {inserted} rooms ({skipped} skipped)")


if __name__ == "__main__":
    main()
