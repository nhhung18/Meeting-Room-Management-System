# Task 1: ORM Models + Pydantic Schemas + Migration 0002

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data layer for booking-service: ORM models (Booking, BookingAttendee, RoomSnapshot), Pydantic DTOs, Alembic migration 0002, and schema validation tests — so that Tasks 2–5 of the master plan have a stable foundation to build on.

**Architecture:** Mirrors room-service's layered pattern — `models/base.py` → `models/booking.py` + `models/room_snapshot.py` → `schemas/booking.py`. All ORM models map 1:1 to tables created by migration 0001; migration 0002 only adds the `owner_id` column to `room_snapshots` for RBAC (Task 18 in roadmap). Pydantic schemas enforce DTO-level validation (end > start, num_attendees > 0) while business rules (capacity, overlap, past-time) belong to the service layer (master plan Task 3).

**Tech Stack:** SQLAlchemy 2.0 (Mapped/mapped_column), Pydantic v2, PostgreSQL, Alembic, pytest

**Spec:** `docs/erd.md` (table definitions), `docs/assumptions.md` (business rules that DTOs partially enforce), master plan `docs/superpowers/plans/2026-10-21-booking-core-concurrency.md` Task 1

## Global Constraints

- Python 3.12, ruff line-length 100, pre-commit required
- Follow room-service model patterns exactly: `Mapped[]` + `mapped_column()`, `StrEnum` for status
- `TIMESTAMP(timezone=True)` for all datetime columns, `JSONB` for equipment
- Unit tests run without DB: `conftest.py` sets dummy `DATABASE_URL`
- Conventional commits: `feat(booking): ...`

## Review Focus

1. **Naive-datetime in BookingCreate:** user omits timezone in `start_at` / `end_at` → schema must reject (validator checks `tzinfo is not None`). Test in subtask 1.4 step 1.
2. **end_at == start_at (zero-duration booking):** validator must reject — `end_at > start_at`, not `>=`. Test in subtask 1.4 step 1.
3. **BookingUpdate with no fields set:** `model_dump(exclude_unset=True)` returns `{}` — this is valid (noop update), not a validation error. Test in subtask 1.4 step 1.
4. **AttendeeInput with blank name:** `name=" "` must be rejected — `min_length=1` after strip. Test in subtask 1.4 step 1.
5. **Booking model ↔ migration column mismatch:** every column in migration 0001 must have a corresponding `Mapped` attribute. Verified by alembic env.py importing `Base.metadata`. No separate test — the existing integration test (`make test-integration`) will catch drift.

---

## File Structure

All paths relative to `services/booking-service/`.

| File | Responsibility | New/Modify |
|---|---|---|
| `app/models/base.py` | `DeclarativeBase` | Create |
| `app/models/booking.py` | `BookingStatus`, `Booking`, `BookingAttendee` ORM | Create |
| `app/models/room_snapshot.py` | `RoomSnapshot` ORM | Create |
| `app/models/__init__.py` | Re-export all models + Base | Create |
| `app/schemas/__init__.py` | Empty package init | Create |
| `app/schemas/booking.py` | Pydantic DTOs | Create |
| `alembic/versions/0002_add_owner_id_to_room_snapshots.py` | Add `owner_id` column | Create |
| `alembic/env.py:13` | Set `target_metadata = Base.metadata` | Modify |
| `tests/test_booking_schemas.py` | Schema validation tests | Create |

---

### Subtask 1.1: DeclarativeBase + BookingStatus enum + Booking model

**Files:**
- Create: `app/models/base.py`
- Create: `app/models/booking.py`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `Base` — `DeclarativeBase` (imported by all models + alembic env.py)
  - `BookingStatus(StrEnum)` — `CONFIRMED = "CONFIRMED"`, `CHECKED_IN = "CHECKED_IN"`, `CANCELLED = "CANCELLED"`
  - `Booking(Base)` — `__tablename__ = "bookings"`, attrs: `id: Mapped[int]`, `room_id: Mapped[int]`, `user_id: Mapped[str]`, `start_at: Mapped[datetime]`, `end_at: Mapped[datetime]`, `num_attendees: Mapped[int]`, `status: Mapped[str]` (server_default `"CONFIRMED"`), `checked_in_at: Mapped[datetime | None]`, `auto_cancelled_at: Mapped[datetime | None]`, `created_at: Mapped[datetime]`, `updated_at: Mapped[datetime]`, `deleted_at: Mapped[datetime | None]`, `attendees` (relationship → `BookingAttendee`, `cascade="all, delete-orphan"`, `lazy="selectin"`)
  - `BookingAttendee(Base)` — `__tablename__ = "booking_attendees"`, attrs: `id: Mapped[int]`, `booking_id: Mapped[int]` (ForeignKey `bookings.id`), `attendee_email: Mapped[str]`, `name: Mapped[str]`, `created_at: Mapped[datetime]`

- [ ] **Step 1: Create `app/models/base.py`**

Same pattern as `services/room-service/app/models/base.py`: import `DeclarativeBase`, define `class Base(DeclarativeBase): pass`.

- [ ] **Step 2: Create `app/models/booking.py`**

`BookingStatus(StrEnum)` with three values. `Booking(Base)` mapping to `bookings` table — every column from migration 0001. Use `sa.TIMESTAMP(timezone=True)` for datetime columns, `sa.VARCHAR` for strings, `sa.Integer` for ints. Add `relationship("BookingAttendee", back_populates="booking", cascade="all, delete-orphan", lazy="selectin")`. `BookingAttendee(Base)` mapping to `booking_attendees` — include `booking: Mapped["Booking"] = relationship(back_populates="attendees")`. Add `__repr__` on both.

- [ ] **Step 3: Commit**

```bash
git add services/booking-service/app/models/base.py services/booking-service/app/models/booking.py
git commit -m "feat(booking): add DeclarativeBase, BookingStatus, Booking and BookingAttendee models"
```

---

### Subtask 1.2: RoomSnapshot model + models `__init__.py`

**Files:**
- Create: `app/models/room_snapshot.py`
- Create: `app/models/__init__.py`

**Interfaces:**
- Consumes: `Base` from subtask 1.1
- Produces:
  - `RoomSnapshot(Base)` — `__tablename__ = "room_snapshots"`, attrs: `room_id: Mapped[int]` (primary_key), `name: Mapped[str]`, `capacity: Mapped[int]`, `status: Mapped[str]` (server_default `"AVAILABLE"`), `equipment: Mapped[list]` (JSONB), `owner_id: Mapped[str | None]`, `version: Mapped[int]` (server_default `"0"`), `last_synced: Mapped[datetime]`
  - `app.models` package re-exports: `Base`, `Booking`, `BookingAttendee`, `BookingStatus`, `RoomSnapshot`

- [ ] **Step 1: Create `app/models/room_snapshot.py`**

`RoomSnapshot(Base)` mapping to `room_snapshots`. All columns from migration 0001 plus `owner_id: Mapped[str | None] = mapped_column(sa.VARCHAR(255), nullable=True)` (added by migration 0002). Add `__repr__`.

- [ ] **Step 2: Create `app/models/__init__.py`**

```python
from app.models.base import Base
from app.models.booking import Booking, BookingAttendee, BookingStatus
from app.models.room_snapshot import RoomSnapshot

__all__ = ["Base", "Booking", "BookingAttendee", "BookingStatus", "RoomSnapshot"]
```

- [ ] **Step 3: Commit**

```bash
git add services/booking-service/app/models/room_snapshot.py services/booking-service/app/models/__init__.py
git commit -m "feat(booking): add RoomSnapshot model and models package init"
```

---

### Subtask 1.3: Migration 0002 + update alembic env.py

**Files:**
- Create: `alembic/versions/0002_add_owner_id_to_room_snapshots.py`
- Modify: `alembic/env.py:13`

**Interfaces:**
- Consumes: `Base.metadata` from subtask 1.1
- Produces:
  - Migration that adds `owner_id VARCHAR(255) NULL` to `room_snapshots`
  - `alembic/env.py` now uses `target_metadata = Base.metadata` for future autogenerate

- [ ] **Step 1: Create migration `alembic/versions/0002_add_owner_id_to_room_snapshots.py`**

```python
revision: str = "0002"
down_revision: str = "0001"

def upgrade() -> None:
    op.add_column("room_snapshots", sa.Column("owner_id", sa.VARCHAR(255), nullable=True))

def downgrade() -> None:
    op.drop_column("room_snapshots", "owner_id")
```

- [ ] **Step 2: Update `alembic/env.py` line 13**

Replace `target_metadata = None` with:

```python
from app.models.base import Base
target_metadata = Base.metadata
```

Also update the comment on line 12 that says "Chưa có ORM models" — remove it.

- [ ] **Step 3: Verify migration applies**

Run: `docker compose up -d postgres && make migrate`
Expected: `0002_add_owner_id_to_room_snapshots` applies without error

- [ ] **Step 4: Commit**

```bash
git add services/booking-service/alembic/
git commit -m "feat(booking): add migration 0002 (owner_id on room_snapshots) and wire alembic metadata"
```

---

### Subtask 1.4: Pydantic Schemas + Validation Tests

**Files:**
- Create: `app/schemas/__init__.py`
- Create: `app/schemas/booking.py`
- Create: `tests/test_booking_schemas.py`

**Interfaces:**
- Consumes: `BookingStatus` from subtask 1.1 (for status field type in response)
- Produces:
  - `AttendeeInput(BaseModel)` — `email: EmailStr`, `name: str = Field(..., min_length=1, max_length=255)` with `strip_name` validator
  - `BookingCreate(BaseModel)` — `room_id: int = Field(..., gt=0)`, `start_at: datetime`, `end_at: datetime`, `num_attendees: int = Field(..., gt=0)`, `attendees: list[AttendeeInput] = Field(default_factory=list)`. Validators: `ensure_tz_aware` (both datetimes must have tzinfo), `end_after_start` (`end_at > start_at`)
  - `BookingUpdate(BaseModel)` — `start_at: datetime | None = None`, `end_at: datetime | None = None`, `num_attendees: int | None = Field(None, gt=0)`, `attendees: list[AttendeeInput] | None = None`. Validator: `end_after_start` when both present
  - `AttendeeResponse(BaseModel)` — `model_config = ConfigDict(from_attributes=True)`, `id: int`, `attendee_email: str`, `name: str`
  - `BookingResponse(BaseModel)` — `model_config = ConfigDict(from_attributes=True)`, fields: `id: int`, `room_id: int`, `user_id: str`, `start_at: datetime`, `end_at: datetime`, `num_attendees: int`, `status: str`, `checked_in_at: datetime | None`, `created_at: datetime`, `updated_at: datetime`, `attendees: list[AttendeeResponse] = []`, `room_name: str | None = None`
  - `BookingListResponse(BaseModel)` — `items: list[BookingResponse]`, `total: int`, `limit: int`, `offset: int`

- [ ] **Step 1: Write schema tests `tests/test_booking_schemas.py`**

```python
from datetime import UTC, datetime, timedelta
import pytest
from pydantic import ValidationError

# --- BookingCreate ---

def test_booking_create_valid():
    future = datetime.now(UTC) + timedelta(hours=1)
    dto = BookingCreate(room_id=1, start_at=future, end_at=future + timedelta(hours=1), num_attendees=5)
    assert dto.room_id == 1
    assert dto.num_attendees == 5
    assert dto.attendees == []

def test_booking_create_end_before_start_rejected():
    future = datetime.now(UTC) + timedelta(hours=2)
    with pytest.raises(ValidationError, match="end_at must be after start_at"):
        BookingCreate(room_id=1, start_at=future, end_at=future - timedelta(hours=1), num_attendees=5)

def test_booking_create_end_equals_start_rejected():
    future = datetime.now(UTC) + timedelta(hours=1)
    with pytest.raises(ValidationError, match="end_at must be after start_at"):
        BookingCreate(room_id=1, start_at=future, end_at=future, num_attendees=5)

def test_booking_create_zero_attendees_rejected():
    future = datetime.now(UTC) + timedelta(hours=1)
    with pytest.raises(ValidationError):
        BookingCreate(room_id=1, start_at=future, end_at=future + timedelta(hours=1), num_attendees=0)

def test_booking_create_naive_datetime_rejected():
    naive = datetime(2099, 1, 1, 9, 0)  # no tzinfo
    with pytest.raises(ValidationError, match="timezone"):
        BookingCreate(room_id=1, start_at=naive, end_at=naive + timedelta(hours=1), num_attendees=5)

def test_booking_create_with_attendees():
    future = datetime.now(UTC) + timedelta(hours=1)
    dto = BookingCreate(
        room_id=1, start_at=future, end_at=future + timedelta(hours=1),
        num_attendees=2, attendees=[AttendeeInput(email="a@b.com", name="Alice")]
    )
    assert len(dto.attendees) == 1
    assert dto.attendees[0].email == "a@b.com"

# --- BookingUpdate ---

def test_booking_update_partial():
    dto = BookingUpdate(num_attendees=10)
    assert dto.start_at is None
    assert dto.num_attendees == 10

def test_booking_update_empty_is_valid():
    dto = BookingUpdate()
    assert dto.model_dump(exclude_unset=True) == {}

def test_booking_update_end_before_start_rejected():
    future = datetime.now(UTC) + timedelta(hours=2)
    with pytest.raises(ValidationError, match="end_at must be after start_at"):
        BookingUpdate(start_at=future, end_at=future - timedelta(hours=1))

# --- AttendeeInput ---

def test_attendee_input_blank_name_rejected():
    with pytest.raises(ValidationError):
        AttendeeInput(email="a@b.com", name="   ")

def test_attendee_input_strips_name():
    a = AttendeeInput(email="a@b.com", name="  Alice  ")
    assert a.name == "Alice"

def test_attendee_input_invalid_email_rejected():
    with pytest.raises(ValidationError):
        AttendeeInput(email="not-an-email", name="Alice")

# --- BookingResponse ---

def test_booking_response_from_attributes():
    # Verify ConfigDict(from_attributes=True) works with a mock object
    ...
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/booking-service && python -m pytest tests/test_booking_schemas.py -v`
Expected: FAIL — `ImportError: cannot import name 'BookingCreate'`

- [ ] **Step 3: Create `app/schemas/__init__.py`**

Empty file.

- [ ] **Step 4: Implement schemas in `app/schemas/booking.py`**

`AttendeeInput`: `email` as `EmailStr`, `name` as `str = Field(..., min_length=1, max_length=255)` with `@field_validator("name")` that strips whitespace then checks non-blank (same pattern as `RoomCreate.strip_name`).

`BookingCreate`: fields as specified in Interfaces. `@model_validator(mode="after")` named `end_after_start` that raises `ValueError("end_at must be after start_at")` if `end_at <= start_at`. `@field_validator("start_at", "end_at")` named `ensure_tz_aware` that raises `ValueError("timezone-aware datetime required")` if `v.tzinfo is None`.

`BookingUpdate`: optional fields. Same `end_after_start` model_validator, but only when both `start_at` and `end_at` are set (not None).

`AttendeeResponse`, `BookingResponse`, `BookingListResponse`: as specified in Interfaces.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd services/booking-service && python -m pytest tests/test_booking_schemas.py -v`
Expected: all PASS

- [ ] **Step 6: Run linter**

Run: `cd services/booking-service && python -m ruff check app/schemas/ tests/test_booking_schemas.py`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add services/booking-service/app/schemas/ services/booking-service/tests/test_booking_schemas.py
git commit -m "feat(booking): add Pydantic schemas with validation tests"
```

---

## Post-Task 1: Verification

- [ ] Run full unit test suite: `cd services/booking-service && python -m pytest tests/ -v --ignore=tests/integration`
  Expected: existing health tests + new schema tests all PASS
- [ ] Run `make lint` from project root — no errors
- [ ] Verify Docker build: `docker compose build booking-service` — succeeds (models import correctly)
- [ ] Verify migration: `docker compose up -d postgres && make migrate` — 0002 applies

---

## What's Next

This plan covers master plan Task 1 only. After completion and review:
- **Master Task 2** (Repositories) will consume `Booking`, `BookingAttendee`, `RoomSnapshot` models and `BookingCreate`, `BookingResponse`, `BookingListResponse` schemas produced here.
- Plan for Task 2 will be written after Task 1 is merged / approved.
