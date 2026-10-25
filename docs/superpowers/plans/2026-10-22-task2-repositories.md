# Task 2: Repository Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the repository (data-access) layer for booking-service: `BookingRepository` and `RoomSnapshotRepository` — thin wrappers over SQLAlchemy `Session` that encapsulate all DB queries, following the pattern `flush()` in repo / `commit()` in router.

**Architecture:** Repositories take a `Session` via constructor injection (≈ Spring `@Repository` with EntityManager). Each method builds a query, calls `session.execute()`, and returns ORM objects or scalars. `flush()` is called after writes so the caller (service/router) can inspect IDs before committing. `commit()` is never called inside a repository — the router does that. Soft-delete is respected on all reads (`WHERE deleted_at IS NULL`). `RoomSnapshotRepository.upsert()` includes the version idempotency guard from ADR-0003.

**Tech Stack:** SQLAlchemy 2.0 (select, Session), pytest, unittest.mock

**Spec:** Master plan `docs/superpowers/plans/2026-10-21-booking-core-concurrency.md` Task 2, `docs/erd.md`, `docs/adr/0003-room-data-access-via-events.md` (version guard)

## Global Constraints

- Python 3.12, ruff line-length 100, pre-commit required
- `flush()` in repository, `commit()` in router — never commit inside a repository
- All reads filter `deleted_at IS NULL` (soft delete)
- Unit tests mock `Session` — no real DB needed
- Conventional commits: `feat(booking): ...`
- Follow `Mapped[]` + `mapped_column()` style for any model touches (none expected)

## Review Focus

1. **Soft-deleted bookings leak into list results:** every `WHERE` on `bookings` must include `deleted_at IS NULL`. A forgotten filter returns cancelled-then-deleted bookings to users. Test: `test_list_by_user_excludes_soft_deleted` in Subtask 2.1.
2. **Overlap check includes the booking being updated:** `has_overlap` must accept `exclude_id` to skip the current booking during updates — otherwise editing a booking's time always conflicts with itself. Test: `test_has_overlap_excludes_self` in Subtask 2.1.
3. **Snapshot upsert replays old events:** if an event with `version=3` arrives after `version=5` has been applied, the upsert must be a no-op (idempotency per ADR-0003). Test: `test_upsert_skips_stale_version` in Subtask 2.2.
4. **`list_by_user` returns wrong count with offset:** `total` must be the count of ALL matching rows (before LIMIT/OFFSET), not just the returned page. Test: `test_list_by_user_returns_correct_total` in Subtask 2.1.
5. **`has_overlap` includes CANCELLED bookings:** the overlap query must filter `status IN ('CONFIRMED', 'CHECKED_IN')` — a cancelled booking should never block a new one. Test: `test_has_overlap_ignores_cancelled` in Subtask 2.1.

---

## File Structure

All paths relative to `services/booking-service/`.

| File | Responsibility | New/Modify |
|---|---|---|
| `app/repositories/__init__.py` | Re-export repositories | Create |
| `app/repositories/booking_repository.py` | `BookingRepository`: CRUD + overlap check on `bookings` | Create |
| `app/repositories/room_snapshot_repository.py` | `RoomSnapshotRepository`: get/upsert/list on `room_snapshots` | Create |
| `tests/test_booking_repository.py` | Unit tests for `BookingRepository` (mocked Session) | Create |
| `tests/test_room_snapshot_repository.py` | Unit tests for `RoomSnapshotRepository` (mocked Session) | Create |

---

### Subtask 2.1: BookingRepository + tests

**Files:**
- Create: `app/repositories/__init__.py`
- Create: `app/repositories/booking_repository.py`
- Create: `tests/test_booking_repository.py`

**Interfaces:**
- Consumes:
  - `Booking` from `app.models.booking` (Task 1)
  - `BookingAttendee` from `app.models.booking` (Task 1)
  - `BookingStatus` from `app.models.booking` (Task 1)
- Produces:
  - `BookingRepository.__init__(self, db: Session) -> None`
  - `BookingRepository.create(self, booking: Booking) -> Booking` — `session.add(booking); session.flush()`; returns booking with `id` populated
  - `BookingRepository.get_by_id(self, booking_id: int) -> Booking | None` — `WHERE id = :id AND deleted_at IS NULL`; uses `selectinload(Booking.attendees)`
  - `BookingRepository.list_by_user(self, user_id: str, *, status: str | None = None, limit: int = 20, offset: int = 0) -> tuple[list[Booking], int]` — returns `(items, total_count)`; filters `deleted_at IS NULL`, optionally `status = :status`
  - `BookingRepository.list_by_room(self, room_id: int, *, status: str | None = None, limit: int = 20, offset: int = 0) -> tuple[list[Booking], int]` — same shape, filter by `room_id`
  - `BookingRepository.has_overlap(self, room_id: int, start_at: datetime, end_at: datetime, *, exclude_id: int | None = None) -> bool` — `WHERE room_id = :rid AND start_at < :end AND end_at > :start AND status IN ('CONFIRMED', 'CHECKED_IN') AND deleted_at IS NULL [AND id != :exclude_id]`
  - `BookingRepository.update(self, booking: Booking) -> Booking` — sets `booking.updated_at = datetime.now(UTC)`; `session.flush()`

- [ ] **Step 1: Write failing tests `tests/test_booking_repository.py`**

```python
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingStatus
from app.repositories.booking_repository import BookingRepository


@pytest.fixture
def mock_db():
    return MagicMock(spec=Session)


@pytest.fixture
def repo(mock_db):
    return BookingRepository(mock_db)


def _make_booking(**overrides):
    defaults = {
        "id": 1, "room_id": 1, "user_id": "u1",
        "start_at": datetime(2099, 1, 1, 9, 0, tzinfo=UTC),
        "end_at": datetime(2099, 1, 1, 10, 0, tzinfo=UTC),
        "num_attendees": 5, "status": BookingStatus.CONFIRMED,
        "deleted_at": None,
    }
    defaults.update(overrides)
    b = Booking(**defaults)
    return b


class TestCreate:
    def test_create_adds_and_flushes(self, repo, mock_db):
        booking = _make_booking()
        result = repo.create(booking)
        mock_db.add.assert_called_once_with(booking)
        mock_db.flush.assert_called_once()
        assert result is booking

    def test_create_does_not_commit(self, repo, mock_db):
        repo.create(_make_booking())
        mock_db.commit.assert_not_called()


class TestGetById:
    def test_returns_booking_when_found(self, repo, mock_db):
        booking = _make_booking()
        mock_db.execute.return_value.scalar_one_or_none.return_value = booking
        result = repo.get_by_id(1)
        assert result is booking

    def test_returns_none_when_not_found(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        result = repo.get_by_id(999)
        assert result is None


class TestListByUser:
    def test_returns_items_and_total(self, repo, mock_db):
        bookings = [_make_booking(id=1), _make_booking(id=2)]
        mock_db.execute.return_value.scalars.return_value.all.return_value = bookings
        mock_db.execute.return_value.scalar_one.return_value = 2
        items, total = repo.list_by_user("u1")
        assert len(items) == 2
        assert total == 2


class TestHasOverlap:
    def test_overlap_detected(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one.return_value = 1
        assert repo.has_overlap(1, datetime(2099, 1, 1, 9, tzinfo=UTC), datetime(2099, 1, 1, 10, tzinfo=UTC)) is True

    def test_no_overlap(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one.return_value = 0
        assert repo.has_overlap(1, datetime(2099, 1, 1, 9, tzinfo=UTC), datetime(2099, 1, 1, 10, tzinfo=UTC)) is False


class TestUpdate:
    def test_update_flushes_and_sets_updated_at(self, repo, mock_db):
        booking = _make_booking()
        old_updated = booking.updated_at
        result = repo.update(booking)
        mock_db.flush.assert_called_once()
        assert result is booking
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/booking-service && python -m pytest tests/test_booking_repository.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.repositories.booking_repository'`

- [ ] **Step 3: Create `app/repositories/__init__.py`**

Empty file (re-exports added in Subtask 2.2 step 5).

- [ ] **Step 4: Implement `BookingRepository` in `app/repositories/booking_repository.py`**

Constructor stores `self._db: Session`. Each query method builds a `select(Booking)` statement with `.where()` clauses. `get_by_id` uses `selectinload(Booking.attendees)` and filters `Booking.deleted_at.is_(None)`. `list_by_user`/`list_by_room` run two queries: one with `.limit().offset()` for items, one with `func.count()` for total. `has_overlap` counts matching rows using the half-open interval logic `start_at < :end AND end_at > :start`. `create` calls `session.add(); session.flush()`. `update` sets `updated_at = datetime.now(UTC)` then calls `session.flush()`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd services/booking-service && python -m pytest tests/test_booking_repository.py -v`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add services/booking-service/app/repositories/__init__.py \
      services/booking-service/app/repositories/booking_repository.py \
      services/booking-service/tests/test_booking_repository.py
git commit -m "feat(booking): add BookingRepository with unit tests"
```

---

### Subtask 2.2: RoomSnapshotRepository + tests + package __init__

**Files:**
- Create: `app/repositories/room_snapshot_repository.py`
- Create: `tests/test_room_snapshot_repository.py`
- Modify: `app/repositories/__init__.py` — add re-exports

**Interfaces:**
- Consumes:
  - `RoomSnapshot` from `app.models.room_snapshot` (Task 1)
- Produces:
  - `RoomSnapshotRepository.__init__(self, db: Session) -> None`
  - `RoomSnapshotRepository.get_by_room_id(self, room_id: int) -> RoomSnapshot | None`
  - `RoomSnapshotRepository.upsert(self, room_id: int, name: str, capacity: int, status: str, equipment: list, owner_id: str | None, version: int) -> RoomSnapshot | None` — returns the snapshot if actually written, `None` if skipped (stale version). Idempotency: skip when `incoming_version <= existing.version`
  - `RoomSnapshotRepository.list_available(self, *, min_capacity: int = 0) -> list[RoomSnapshot]` — `WHERE status = 'AVAILABLE' [AND capacity >= min_capacity]`

- [ ] **Step 1: Write failing tests `tests/test_room_snapshot_repository.py`**

```python
from unittest.mock import MagicMock

import pytest
from sqlalchemy.orm import Session

from app.models.room_snapshot import RoomSnapshot
from app.repositories.room_snapshot_repository import RoomSnapshotRepository


@pytest.fixture
def mock_db():
    return MagicMock(spec=Session)


@pytest.fixture
def repo(mock_db):
    return RoomSnapshotRepository(mock_db)


def _make_snapshot(**overrides):
    defaults = {
        "room_id": 1, "name": "Room A", "capacity": 10,
        "status": "AVAILABLE", "equipment": [], "owner_id": None, "version": 1,
    }
    defaults.update(overrides)
    return RoomSnapshot(**defaults)


class TestGetByRoomId:
    def test_returns_snapshot_when_found(self, repo, mock_db):
        snap = _make_snapshot()
        mock_db.execute.return_value.scalar_one_or_none.return_value = snap
        result = repo.get_by_room_id(1)
        assert result is snap

    def test_returns_none_when_not_found(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        assert repo.get_by_room_id(999) is None


class TestUpsert:
    def test_insert_new_snapshot(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        result = repo.upsert(room_id=1, name="Room A", capacity=10, status="AVAILABLE", equipment=[], owner_id=None, version=1)
        assert result is not None
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()

    def test_upsert_updates_newer_version(self, repo, mock_db):
        existing = _make_snapshot(version=3)
        mock_db.execute.return_value.scalar_one_or_none.return_value = existing
        result = repo.upsert(room_id=1, name="Room A Updated", capacity=20, status="AVAILABLE", equipment=["projector"], owner_id="mgr1", version=5)
        assert result is not None
        assert existing.name == "Room A Updated"
        assert existing.version == 5
        mock_db.flush.assert_called_once()

    def test_upsert_skips_stale_version(self, repo, mock_db):
        existing = _make_snapshot(version=5)
        mock_db.execute.return_value.scalar_one_or_none.return_value = existing
        result = repo.upsert(room_id=1, name="Stale", capacity=5, status="MAINTENANCE", equipment=[], owner_id=None, version=3)
        assert result is None
        assert existing.name == "Room A"  # unchanged
        mock_db.flush.assert_not_called()

    def test_upsert_skips_same_version(self, repo, mock_db):
        existing = _make_snapshot(version=5)
        mock_db.execute.return_value.scalar_one_or_none.return_value = existing
        result = repo.upsert(room_id=1, name="Same", capacity=5, status="MAINTENANCE", equipment=[], owner_id=None, version=5)
        assert result is None
        mock_db.flush.assert_not_called()


class TestListAvailable:
    def test_returns_available_rooms(self, repo, mock_db):
        rooms = [_make_snapshot(room_id=1), _make_snapshot(room_id=2)]
        mock_db.execute.return_value.scalars.return_value.all.return_value = rooms
        result = repo.list_available()
        assert len(result) == 2

    def test_filters_by_min_capacity(self, repo, mock_db):
        mock_db.execute.return_value.scalars.return_value.all.return_value = []
        result = repo.list_available(min_capacity=50)
        assert result == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/booking-service && python -m pytest tests/test_room_snapshot_repository.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.repositories.room_snapshot_repository'`

- [ ] **Step 3: Implement `RoomSnapshotRepository` in `app/repositories/room_snapshot_repository.py`**

Constructor stores `self._db: Session`. `get_by_room_id`: `select(RoomSnapshot).where(RoomSnapshot.room_id == room_id)`. `upsert`: fetch existing; if `None` → create new `RoomSnapshot(...)`, `session.add()`, `session.flush()`, return it; if `existing.version >= incoming_version` → return `None` (skip); otherwise update all fields on existing, `session.flush()`, return it. `list_available`: `select(RoomSnapshot).where(RoomSnapshot.status == 'AVAILABLE')`, optionally `.where(RoomSnapshot.capacity >= min_capacity)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/booking-service && python -m pytest tests/test_room_snapshot_repository.py -v`
Expected: all PASS

- [ ] **Step 5: Update `app/repositories/__init__.py` with re-exports**

```python
from app.repositories.booking_repository import BookingRepository
from app.repositories.room_snapshot_repository import RoomSnapshotRepository

__all__ = ["BookingRepository", "RoomSnapshotRepository"]
```

- [ ] **Step 6: Run full unit test suite**

Run: `cd services/booking-service && python -m pytest tests/ -v --ignore=tests/integration`
Expected: all tests PASS (existing health + schema + both repository test files)

- [ ] **Step 7: Commit**

```bash
git add services/booking-service/app/repositories/ \
      services/booking-service/tests/test_room_snapshot_repository.py
git commit -m "feat(booking): add RoomSnapshotRepository with version-guard upsert"
```

---

## Post-Task 2: Verification

- [ ] Run full unit test suite: `cd services/booking-service && python -m pytest tests/ -v --ignore=tests/integration`
  Expected: all existing + new tests PASS
- [ ] Run `cd services/booking-service && python -m ruff check app/repositories/ tests/test_booking_repository.py tests/test_room_snapshot_repository.py` — no errors
- [ ] Verify imports: `python -c "from app.repositories import BookingRepository, RoomSnapshotRepository; print('OK')"` (from `services/booking-service/`)

---

## What's Next

This plan covers master plan Task 2 only. After completion:
- **Master Task 3** (BookingService) will consume `BookingRepository` and `RoomSnapshotRepository` produced here to implement all business validations.
- Plan for Task 3 will be written after Task 2 is done.
