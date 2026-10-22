# Booking Core & Concurrency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the booking CRUD API (tasks 14–18 in progress.md) with all business validations from `docs/assumptions.md`, room snapshot integration (ADR-0003), JWT/RBAC authorization, and concurrency tests proving the EXCLUDE constraint prevents double-booking through the full stack.

**Architecture:** Follows the same layered pattern as room-service: models → schemas → repositories → services → API routers. Booking-service validates against local `room_snapshots` (ADR-0003) instead of calling room-service per request. The PostgreSQL EXCLUDE constraint is the ultimate double-booking guard; application-level pre-checks provide friendly error messages. A sync endpoint lets an admin populate `room_snapshots` from room-service's HTTP API (initial sync); event-driven sync is deferred to week 5.

**Tech Stack:** FastAPI, SQLAlchemy (sync), Pydantic v2, PostgreSQL (EXCLUDE constraint, btree_gist), pytest, httpx (for room-service HTTP call), libs/common (JWT, logging, config, request_id)

**Spec:** `docs/assumptions.md` (6 business rules), `docs/erd.md` (schema), `docs/adr/0003-room-data-access-via-events.md`

## Global Constraints

- Python 3.12, ruff (line length 100), pre-commit
- All timestamps UTC `timestamptz`; display Asia/Saigon
- Soft delete via `deleted_at`; schema changes only via Alembic migrations
- Conventional commits, one concern per PR, squash merge
- JSON structured logging with `request_id` on every line
- No hardcoded secrets; all config via env vars (`pydantic-settings`)
- Unit tests run without DB (`DATABASE_URL` dummy in `conftest.py`)
- Integration tests require running Postgres + migration; marked `@pytest.mark.integration`
- Follow room-service patterns exactly: `flush()` in repo, `commit()` in router

## Review Focus

1. **Past-time booking attempt:** user sends `start_at` 1 second in the past → service raises `PastBookingError`, API returns 422 — not a silently created booking. Test in Task 3.
2. **Capacity exactly at limit:** `num_attendees == room.capacity` → allowed; `num_attendees == capacity + 1` → `CapacityExceededError` / 422. Test in Task 3.
3. **Cancel already-cancelled booking:** `POST /{id}/cancel` on a CANCELLED booking → `InvalidStateError` / 409, not a second cancellation. Test in Task 3.
4. **MAINTENANCE room booking:** `room_snapshot.status = 'MAINTENANCE'` → `RoomNotAvailableError` / 409. Test in Task 3.
5. **Concurrent overlapping bookings:** 10 simultaneous requests for same room+slot → exactly 1 × 201, 9 × 409. Test in Task 5.

---

## File Structure

### New files in `services/booking-service/`

```
app/
├── models/
│   ├── __init__.py              # re-export Base, Booking, BookingAttendee, RoomSnapshot
│   ├── base.py                  # DeclarativeBase (same pattern as room-service)
│   ├── booking.py               # Booking, BookingAttendee, BookingStatus
│   └── room_snapshot.py         # RoomSnapshot
├── schemas/
│   ├── __init__.py
│   └── booking.py               # BookingCreate, BookingUpdate, BookingResponse, BookingListResponse, AttendeeInput
├── repositories/
│   ├── __init__.py
│   ├── booking_repository.py    # BookingRepository
│   └── room_snapshot_repository.py  # RoomSnapshotRepository
├── services/
│   ├── __init__.py
│   ├── booking_service.py       # BookingService + domain exceptions
│   └── room_snapshot_sync.py    # RoomSnapshotSync (HTTP fetch from room-service)
├── api/
│   └── bookings.py              # CRUD + cancel + sync-rooms endpoints
└── core/
    └── security.py              # JWT/RBAC dependencies (copy pattern from room-service)

alembic/
└── versions/
    └── 0002_add_owner_id_to_room_snapshots.py  # owner_id column for RBAC

tests/
├── conftest.py                  # MODIFY: add auth override fixtures
├── test_booking_schemas.py      # schema validation
├── test_booking_service.py      # service layer unit tests
├── test_bookings_api.py         # API endpoint tests
├── test_security.py             # auth/RBAC tests
└── integration/
    └── test_concurrency.py      # parallel booking tests
```

### Modified files

- `app/core/config.py` — add `room_service_url` field
- `app/main.py` — mount bookings router
- `alembic/env.py` — set `target_metadata` to models' Base.metadata

---

### Task 1: ORM Models + Pydantic Schemas + Migration 0002

**Files:**
- Create: `app/models/__init__.py`
- Create: `app/models/base.py`
- Create: `app/models/booking.py`
- Create: `app/models/room_snapshot.py`
- Create: `app/schemas/__init__.py`
- Create: `app/schemas/booking.py`
- Create: `alembic/versions/0002_add_owner_id_to_room_snapshots.py`
- Modify: `alembic/env.py:13` — `target_metadata = Base.metadata`
- Test: `tests/test_booking_schemas.py`

**Interfaces:**
- Consumes: nothing (foundation task)
- Produces:
  - `BookingStatus(StrEnum)` — `CONFIRMED`, `CHECKED_IN`, `CANCELLED`
  - `Booking` ORM — maps to `bookings` table (all columns from migration 0001)
  - `BookingAttendee` ORM — maps to `booking_attendees` table
  - `RoomSnapshot` ORM — maps to `room_snapshots` table (+ new `owner_id`)
  - `Base` — `DeclarativeBase` shared with Alembic
  - `AttendeeInput(BaseModel)` — `email: EmailStr`, `name: str`
  - `BookingCreate(BaseModel)` — `room_id: int`, `start_at: datetime`, `end_at: datetime`, `num_attendees: int`, `attendees: list[AttendeeInput]`
  - `BookingUpdate(BaseModel)` — `start_at: datetime | None`, `end_at: datetime | None`, `num_attendees: int | None`, `attendees: list[AttendeeInput] | None`
  - `BookingResponse(BaseModel)` — all booking fields + `room_name: str | None`
  - `BookingListResponse(BaseModel)` — `items`, `total`, `limit`, `offset`

- [ ] **Step 1: Create `app/models/base.py`**

Same pattern as `services/room-service/app/models/base.py`:

```python
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass
```

- [ ] **Step 2: Create `app/models/booking.py`**

`BookingStatus(StrEnum)` with values `CONFIRMED`, `CHECKED_IN`, `CANCELLED`. `Booking(Base)` mapping to `bookings` table with all columns from migration 0001. `BookingAttendee(Base)` mapping to `booking_attendees`. Use `Mapped[]` + `mapped_column()` style matching room-service's `Room` model. Include `relationship("BookingAttendee", ...)` on `Booking` for eager-load of attendees.

- [ ] **Step 3: Create `app/models/room_snapshot.py`**

`RoomSnapshot(Base)` mapping to `room_snapshots` table. Include all columns from migration 0001 plus the new `owner_id: Mapped[str | None]` column (added by migration 0002).

- [ ] **Step 4: Create `app/models/__init__.py`**

Re-export `Base`, `Booking`, `BookingAttendee`, `BookingStatus`, `RoomSnapshot`.

- [ ] **Step 5: Create migration `alembic/versions/0002_add_owner_id_to_room_snapshots.py`**

```python
def upgrade() -> None:
    op.add_column("room_snapshots", sa.Column("owner_id", sa.VARCHAR(255), nullable=True))

def downgrade() -> None:
    op.drop_column("room_snapshots", "owner_id")
```

- [ ] **Step 6: Update `alembic/env.py`**

Change line 13 from `target_metadata = None` to:

```python
from app.models.base import Base
target_metadata = Base.metadata
```

- [ ] **Step 7: Create `app/schemas/booking.py`**

`AttendeeInput`: `email` (EmailStr), `name` (str, 1–255).

`BookingCreate`: `room_id` (int, gt=0), `start_at` (datetime), `end_at` (datetime), `num_attendees` (int, gt=0), `attendees` (list[AttendeeInput], default empty). Validators: `end_at > start_at`; both must be timezone-aware.

`BookingUpdate`: all fields optional. Same validators when present.

`BookingResponse`: `ConfigDict(from_attributes=True)`. Fields: `id`, `room_id`, `user_id`, `start_at`, `end_at`, `num_attendees`, `status`, `checked_in_at`, `created_at`, `updated_at`, `room_name` (str | None, not from ORM — set by service). `attendees: list[AttendeeResponse]`.

`AttendeeResponse`: `id`, `attendee_email`, `name`.

`BookingListResponse`: `items: list[BookingResponse]`, `total`, `limit`, `offset`.

- [ ] **Step 8: Write schema tests `tests/test_booking_schemas.py`**

```python
def test_booking_create_valid():
    dto = BookingCreate(room_id=1, start_at=future_dt, end_at=future_dt + timedelta(hours=1), num_attendees=5)
    assert dto.room_id == 1

def test_booking_create_end_before_start_rejected():
    with pytest.raises(ValidationError):
        BookingCreate(room_id=1, start_at=future_dt, end_at=future_dt - timedelta(hours=1), num_attendees=5)

def test_booking_create_zero_attendees_rejected():
    with pytest.raises(ValidationError):
        BookingCreate(room_id=1, start_at=future_dt, end_at=future_dt + timedelta(hours=1), num_attendees=0)

def test_booking_create_with_attendees():
    dto = BookingCreate(..., attendees=[AttendeeInput(email="a@b.com", name="A")])
    assert len(dto.attendees) == 1

def test_booking_update_partial():
    dto = BookingUpdate(num_attendees=10)
    assert dto.start_at is None
    assert dto.num_attendees == 10
```

- [ ] **Step 9: Run tests**

Run: `cd services/booking-service && python -m pytest tests/test_booking_schemas.py -v`
Expected: all PASS

- [ ] **Step 10: Commit**

```bash
git add services/booking-service/app/models/ services/booking-service/app/schemas/ \
      services/booking-service/alembic/ services/booking-service/tests/test_booking_schemas.py
git commit -m "feat(booking): add ORM models, Pydantic schemas and migration 0002"
```

---

### Task 2: Repository Layer

**Files:**
- Create: `app/repositories/__init__.py`
- Create: `app/repositories/booking_repository.py`
- Create: `app/repositories/room_snapshot_repository.py`
- Test: `tests/test_booking_repository.py`

**Interfaces:**
- Consumes: `Booking`, `BookingAttendee`, `RoomSnapshot`, `BookingStatus` from Task 1
- Produces:
  - `BookingRepository.__init__(self, db: Session) -> None`
  - `BookingRepository.create(self, booking: Booking) -> Booking`
  - `BookingRepository.get_by_id(self, booking_id: int) -> Booking | None` — excludes soft-deleted, eager-loads attendees
  - `BookingRepository.list_by_user(self, user_id: str, *, status: str | None, limit: int, offset: int) -> tuple[list[Booking], int]`
  - `BookingRepository.list_by_room(self, room_id: int, *, status: str | None, limit: int, offset: int) -> tuple[list[Booking], int]`
  - `BookingRepository.has_overlap(self, room_id: int, start_at: datetime, end_at: datetime, *, exclude_id: int | None = None) -> bool`
  - `BookingRepository.update(self, booking: Booking) -> Booking`
  - `RoomSnapshotRepository.__init__(self, db: Session) -> None`
  - `RoomSnapshotRepository.get_by_room_id(self, room_id: int) -> RoomSnapshot | None`
  - `RoomSnapshotRepository.upsert(self, room_id: int, name: str, capacity: int, status: str, equipment: list, owner_id: str | None, version: int) -> RoomSnapshot`
  - `RoomSnapshotRepository.list_available(self, *, min_capacity: int = 0) -> list[RoomSnapshot]`

- [ ] **Step 1: Create `app/repositories/booking_repository.py`**

Follow room-service's `RoomRepository` pattern: `flush()` not `commit()`, manual `updated_at` on update, `deleted_at IS NULL` filter on all reads. `has_overlap` uses application-level overlap check: `WHERE room_id = :rid AND start_at < :end AND end_at > :start AND status IN ('CONFIRMED', 'CHECKED_IN') AND deleted_at IS NULL`. `get_by_id` uses `selectinload(Booking.attendees)` for eager loading.

- [ ] **Step 2: Create `app/repositories/room_snapshot_repository.py`**

`upsert`: if snapshot exists and `version <= existing.version`, skip (idempotency guard per ADR-0003). Otherwise insert or update all fields. `list_available`: `WHERE status = 'AVAILABLE'` with optional `capacity >= min_capacity`.

- [ ] **Step 3: Write repository tests `tests/test_booking_repository.py`**

Unit tests with real SQLAlchemy `Session` against in-memory SQLite where possible, or mock-based:

```python
def test_create_booking_flushes_and_returns_id(mock_session):
    repo = BookingRepository(mock_session)
    booking = Booking(room_id=1, user_id="u1", ...)
    result = repo.create(booking)
    mock_session.add.assert_called_once()
    mock_session.flush.assert_called_once()

def test_get_by_id_excludes_soft_deleted(mock_session):
    # configure mock to return None for deleted booking
    result = repo.get_by_id(1)
    assert result is None

def test_has_overlap_detects_conflict(mock_session):
    # configure mock to return count > 0
    assert repo.has_overlap(1, start, end) is True

def test_has_overlap_no_conflict(mock_session):
    # configure mock to return count == 0
    assert repo.has_overlap(1, start, end) is False

def test_snapshot_upsert_skips_old_version(mock_session):
    # existing snapshot version=5, incoming version=3 → no update
    ...

def test_snapshot_upsert_updates_newer_version(mock_session):
    # existing version=3, incoming version=5 → update
    ...
```

- [ ] **Step 4: Run tests**

Run: `cd services/booking-service && python -m pytest tests/test_booking_repository.py -v`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add services/booking-service/app/repositories/ services/booking-service/tests/test_booking_repository.py
git commit -m "feat(booking): add booking and room-snapshot repositories"
```

---

### Task 3: BookingService + All Business Validations

**Files:**
- Create: `app/services/__init__.py`
- Create: `app/services/booking_service.py`
- Create: `app/services/room_snapshot_sync.py`
- Modify: `app/core/config.py:12` — add `room_service_url: str = "http://room-service:8000"`
- Test: `tests/test_booking_service.py`

**Interfaces:**
- Consumes:
  - `BookingRepository.*` from Task 2
  - `RoomSnapshotRepository.*` from Task 2
  - `BookingCreate`, `BookingUpdate`, `BookingResponse`, `BookingListResponse` from Task 1
- Produces:
  - `BookingService.__init__(self, booking_repo: BookingRepository, snapshot_repo: RoomSnapshotRepository) -> None`
  - `BookingService.create_booking(self, dto: BookingCreate, user_id: str) -> BookingResponse`
  - `BookingService.get_booking(self, booking_id: int) -> BookingResponse`
  - `BookingService.list_bookings(self, *, user_id: str | None, room_id: int | None, limit: int, offset: int) -> BookingListResponse`
  - `BookingService.update_booking(self, booking_id: int, dto: BookingUpdate, user_id: str) -> BookingResponse`
  - `BookingService.cancel_booking(self, booking_id: int) -> BookingResponse`
  - Domain exceptions: `NotFoundError`, `RoomNotAvailableError`, `CapacityExceededError`, `OverlapError`, `PastBookingError`, `InvalidStateError`
  - `RoomSnapshotSync.sync_from_room_service(self) -> int` — returns count of synced rooms

- [ ] **Step 1: Write failing tests `tests/test_booking_service.py`**

Mock `BookingRepository` and `RoomSnapshotRepository`. Test each validation from `docs/assumptions.md`:

```python
# --- Helpers ---
def _make_snapshot(room_id=1, capacity=10, status="AVAILABLE", owner_id=None): ...
def _make_booking(id=1, room_id=1, user_id="u1", status="CONFIRMED"): ...

class TestCreateBooking:
    def test_create_success(self, service, mock_snapshot_repo, mock_booking_repo):
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot()
        mock_booking_repo.has_overlap.return_value = False
        result = service.create_booking(dto, user_id="u1")
        assert result.status == "CONFIRMED"
        mock_booking_repo.create.assert_called_once()

    def test_room_not_found_raises(self, service, mock_snapshot_repo):
        mock_snapshot_repo.get_by_room_id.return_value = None
        with pytest.raises(BookingService.NotFoundError):
            service.create_booking(dto, user_id="u1")

    def test_room_maintenance_raises(self, service, mock_snapshot_repo):
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot(status="MAINTENANCE")
        with pytest.raises(BookingService.RoomNotAvailableError):
            service.create_booking(dto, user_id="u1")

    def test_capacity_exceeded_raises(self, service, mock_snapshot_repo):
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot(capacity=5)
        with pytest.raises(BookingService.CapacityExceededError):
            service.create_booking(dto_with_15_attendees, user_id="u1")

    def test_capacity_at_limit_allowed(self, service, mock_snapshot_repo, mock_booking_repo):
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot(capacity=10)
        mock_booking_repo.has_overlap.return_value = False
        result = service.create_booking(dto_with_10_attendees, user_id="u1")
        assert result is not None  # no exception

    def test_past_start_raises(self, service, mock_snapshot_repo):
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot()
        with pytest.raises(BookingService.PastBookingError):
            service.create_booking(dto_with_past_start, user_id="u1")

    def test_overlap_raises(self, service, mock_snapshot_repo, mock_booking_repo):
        mock_snapshot_repo.get_by_room_id.return_value = _make_snapshot()
        mock_booking_repo.has_overlap.return_value = True
        with pytest.raises(BookingService.OverlapError):
            service.create_booking(dto, user_id="u1")

class TestCancelBooking:
    def test_cancel_confirmed_success(self, service, mock_booking_repo):
        mock_booking_repo.get_by_id.return_value = _make_booking(status="CONFIRMED")
        result = service.cancel_booking(1)
        assert result.status == "CANCELLED"

    def test_cancel_already_cancelled_raises(self, service, mock_booking_repo):
        mock_booking_repo.get_by_id.return_value = _make_booking(status="CANCELLED")
        with pytest.raises(BookingService.InvalidStateError):
            service.cancel_booking(1)

    def test_cancel_not_found_raises(self, service, mock_booking_repo):
        mock_booking_repo.get_by_id.return_value = None
        with pytest.raises(BookingService.NotFoundError):
            service.cancel_booking(999)

class TestGetBooking:
    def test_get_existing(self, service, mock_booking_repo):
        mock_booking_repo.get_by_id.return_value = _make_booking()
        result = service.get_booking(1)
        assert result.id == 1

    def test_get_not_found_raises(self, service, mock_booking_repo):
        mock_booking_repo.get_by_id.return_value = None
        with pytest.raises(BookingService.NotFoundError):
            service.get_booking(999)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/booking-service && python -m pytest tests/test_booking_service.py -v`
Expected: FAIL — `BookingService` not yet implemented

- [ ] **Step 3: Implement `BookingService` in `app/services/booking_service.py`**

`create_booking` validation order:
1. Fetch `room_snapshot` by `room_id` → `NotFoundError` if missing
2. Check `snapshot.status == 'AVAILABLE'` → `RoomNotAvailableError`
3. Check `dto.start_at > now(UTC)` → `PastBookingError`
4. Check `dto.num_attendees <= snapshot.capacity` → `CapacityExceededError`
5. Check `has_overlap(room_id, start_at, end_at)` → `OverlapError`
6. Create `Booking` + `BookingAttendee` objects → repo.create
7. Build `BookingResponse` with `room_name = snapshot.name`

`cancel_booking`:
1. Fetch booking → `NotFoundError`
2. Check `status != 'CANCELLED'` → `InvalidStateError`
3. Set `status = 'CANCELLED'`, `updated_at = now(UTC)`

`update_booking`:
1. Fetch booking → `NotFoundError`
2. Check `status == 'CONFIRMED'` → `InvalidStateError` if not
3. Apply changes from `BookingUpdate` (exclude_unset)
4. If time changed: re-validate future, overlap, capacity
5. If attendees changed: replace `booking.attendees`

- [ ] **Step 4: Implement `RoomSnapshotSync` in `app/services/room_snapshot_sync.py`**

Uses `httpx` to GET `{room_service_url}/api/rooms/?limit=100` and upserts each room into `room_snapshots` via `RoomSnapshotRepository.upsert()`. Passes `X-Request-ID` header for trace continuity. Returns count of synced rooms.

- [ ] **Step 5: Add `room_service_url` to `app/core/config.py`**

```python
class Settings(ServiceSettings):
    ...
    room_service_url: str = "http://room-service:8000"
```

- [ ] **Step 6: Run tests**

Run: `cd services/booking-service && python -m pytest tests/test_booking_service.py -v`
Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add services/booking-service/app/services/ services/booking-service/app/core/config.py \
      services/booking-service/tests/test_booking_service.py
git commit -m "feat(booking): add BookingService with all business validations"
```

---

### Task 4: Security + API Endpoints + RBAC

**Files:**
- Create: `app/core/security.py`
- Create: `app/api/bookings.py`
- Modify: `app/main.py:6,50-51` — import and mount bookings router
- Modify: `tests/conftest.py` — add auth override fixtures
- Test: `tests/test_security.py`
- Test: `tests/test_bookings_api.py`

**Interfaces:**
- Consumes:
  - `BookingService.*`, `RoomSnapshotSync.*` from Task 3
  - `BookingCreate`, `BookingUpdate`, `BookingResponse`, `BookingListResponse` from Task 1
  - `common.auth.TokenPayload`, `common.auth.JWTValidator`, `common.auth.require_roles` from libs/common
- Produces:
  - `POST /api/bookings/` → 201 + `BookingResponse` (any authenticated user)
  - `GET /api/bookings/` → 200 + `BookingListResponse` (Employee: own; Manager: rooms they manage; Admin: all)
  - `GET /api/bookings/{id}` → 200 + `BookingResponse` (owner, room manager, admin)
  - `PATCH /api/bookings/{id}` → 200 + `BookingResponse` (owner only while CONFIRMED)
  - `POST /api/bookings/{id}/cancel` → 200 + `BookingResponse` (owner, room manager, admin)
  - `POST /api/bookings/admin/sync-rooms` → 200 + `{"synced": N}` (admin only)
  - `current_user(authorization) -> TokenPayload`
  - `require_admin(user) -> TokenPayload`

- [ ] **Step 1: Create `app/core/security.py`**

Copy pattern from `services/room-service/app/core/security.py`. Provide:
- `get_jwt_validator() -> JWTValidator | None` (singleton, None when AUTH0 not set)
- `current_user(authorization, validator) -> TokenPayload` (401 on invalid)
- `require_admin(user) -> TokenPayload` (403 if not Administrator)

No `require_room_manager` here — booking-service has finer-grained RBAC in the router.

- [ ] **Step 2: Write security tests `tests/test_security.py`**

```python
def test_missing_auth_header_returns_401(client):
    resp = client.post("/api/bookings/")
    assert resp.status_code == 401

def test_anonymous_mode_returns_admin_payload(client):
    # When AUTH0_DOMAIN is not set, current_user returns anonymous admin
    ...

def test_sync_rooms_requires_admin(client):
    # Employee → 403
    ...
```

- [ ] **Step 3: Create `app/api/bookings.py`**

```python
router = APIRouter(tags=["bookings"])

def _get_services(db: Session = Depends(get_db)) -> tuple[BookingService, RoomSnapshotRepository]:
    snapshot_repo = RoomSnapshotRepository(db)
    booking_repo = BookingRepository(db)
    return BookingService(booking_repo, snapshot_repo), snapshot_repo

@router.post("/", response_model=BookingResponse, status_code=201)
def create_booking(body: BookingCreate, user: TokenPayload = Depends(current_user), ...):
    # Any authenticated user can create
    ...

@router.get("/", response_model=BookingListResponse)
def list_bookings(user: TokenPayload = Depends(current_user), ...):
    # Employee: list own (user_id=user.sub)
    # Room Manager: list own + rooms they manage
    # Admin: list all
    ...

@router.get("/{booking_id}", response_model=BookingResponse)
def get_booking(booking_id: int, user: TokenPayload = Depends(current_user), ...):
    # Fetch booking, then check: owner, room manager, or admin
    ...

@router.patch("/{booking_id}", response_model=BookingResponse)
def update_booking(booking_id: int, body: BookingUpdate, user: TokenPayload = Depends(current_user), ...):
    # Only owner can update, only while CONFIRMED
    ...

@router.post("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_booking(booking_id: int, user: TokenPayload = Depends(current_user), ...):
    # Owner, room manager of that room, or admin
    ...

@router.post("/admin/sync-rooms")
def sync_rooms(_user: TokenPayload = Depends(require_admin), ...):
    ...
```

Domain exceptions → HTTP status mapping:
- `NotFoundError` → 404
- `RoomNotAvailableError` → 409
- `CapacityExceededError` → 422
- `OverlapError` → 409
- `PastBookingError` → 422
- `InvalidStateError` → 409
- `IntegrityError` (from EXCLUDE constraint) → 409

RBAC for list/get/cancel:
- Check `user.roles` for "Administrator" → full access
- Check "Room Manager" → query `RoomSnapshotRepository` to see if `snapshot.owner_id == user.sub`
- Otherwise (Employee) → filter by `user_id == user.sub`

- [ ] **Step 4: Update `app/main.py`**

Add import of bookings router and mount it:

```python
from app.api import bookings
app.include_router(bookings.router, prefix=settings.api_prefix)
```

- [ ] **Step 5: Update `tests/conftest.py`**

Add fixtures to override `current_user` with various roles:

```python
@pytest.fixture
def employee_user():
    app.dependency_overrides[current_user] = lambda: TokenPayload(sub="emp1", roles=["Employee"])
    yield
    app.dependency_overrides.pop(current_user, None)

@pytest.fixture
def admin_user():
    app.dependency_overrides[current_user] = lambda: TokenPayload(sub="admin1", roles=["Administrator"])
    yield
    app.dependency_overrides.pop(current_user, None)

@pytest.fixture
def manager_user():
    app.dependency_overrides[current_user] = lambda: TokenPayload(sub="mgr1", roles=["Room Manager"])
    yield
    app.dependency_overrides.pop(current_user, None)
```

Also override `get_db` to provide a mock session for unit tests, and override `BookingService`/`RoomSnapshotRepository` dependencies.

- [ ] **Step 6: Write API tests `tests/test_bookings_api.py`**

```python
class TestCreateBooking:
    def test_create_201(self, client, admin_user, mock_service):
        mock_service.create_booking.return_value = mock_response
        resp = client.post("/api/bookings/", json=valid_body)
        assert resp.status_code == 201

    def test_create_room_not_found_404(self, client, admin_user, mock_service):
        mock_service.create_booking.side_effect = BookingService.NotFoundError("room")
        resp = client.post("/api/bookings/", json=valid_body)
        assert resp.status_code == 404

    def test_create_overlap_409(self, client, admin_user, mock_service):
        mock_service.create_booking.side_effect = BookingService.OverlapError("overlap")
        resp = client.post("/api/bookings/", json=valid_body)
        assert resp.status_code == 409

    def test_create_past_422(self, client, admin_user, mock_service):
        mock_service.create_booking.side_effect = BookingService.PastBookingError("past")
        resp = client.post("/api/bookings/", json=valid_body)
        assert resp.status_code == 422

class TestListBookings:
    def test_employee_sees_own_only(self, client, employee_user, mock_service):
        ...

    def test_admin_sees_all(self, client, admin_user, mock_service):
        ...

class TestCancelBooking:
    def test_owner_can_cancel(self, client, employee_user, mock_service):
        ...

    def test_other_employee_forbidden(self, client, employee_user, mock_service):
        ...

    def test_admin_can_cancel_any(self, client, admin_user, mock_service):
        ...

class TestSyncRooms:
    def test_admin_can_sync(self, client, admin_user, mock_sync):
        ...

    def test_employee_forbidden(self, client, employee_user):
        resp = client.post("/api/bookings/admin/sync-rooms")
        assert resp.status_code == 403
```

- [ ] **Step 7: Run tests**

Run: `cd services/booking-service && python -m pytest tests/test_security.py tests/test_bookings_api.py -v`
Expected: all PASS

- [ ] **Step 8: Commit**

```bash
git add services/booking-service/app/core/security.py services/booking-service/app/api/bookings.py \
      services/booking-service/app/main.py services/booking-service/tests/conftest.py \
      services/booking-service/tests/test_security.py services/booking-service/tests/test_bookings_api.py
git commit -m "feat(booking): add CRUD endpoints with JWT/RBAC authorization"
```

---

### Task 5: Concurrency Integration Tests

**Files:**
- Create: `tests/integration/test_concurrency.py`
- Modify: `tests/integration/test_bookings_schema.py` (optional: add more schema-level tests)

**Interfaces:**
- Consumes: full booking-service stack from Tasks 1–4, running Postgres with migrations applied
- Produces: integration test proving EXCLUDE constraint prevents double-booking through API

- [ ] **Step 1: Write concurrency test `tests/integration/test_concurrency.py`**

```python
import pytest
from concurrent.futures import ThreadPoolExecutor, as_completed

pytestmark = pytest.mark.integration

PARALLEL = 10

def _book_room(base_url: str, room_id: int, start: str, end: str) -> int:
    """POST a booking and return the HTTP status code."""
    import httpx
    resp = httpx.post(
        f"{base_url}/api/bookings/",
        json={"room_id": room_id, "start_at": start, "end_at": end, "num_attendees": 2},
        headers={"Authorization": "Bearer <test-token-or-bypass>"},
        timeout=10,
    )
    return resp.status_code

def test_concurrent_booking_exactly_one_wins(booking_service_url, seeded_room_id):
    """Fire PARALLEL identical booking requests in parallel.
    
    Exactly one must get 201 (EXCLUDE constraint lets it through).
    The rest must get 409 (overlap detected — either by app pre-check or DB constraint).
    """
    start = "2099-01-01T09:00:00+00:00"
    end = "2099-01-01T10:00:00+00:00"

    with ThreadPoolExecutor(max_workers=PARALLEL) as pool:
        futures = [
            pool.submit(_book_room, booking_service_url, seeded_room_id, start, end)
            for _ in range(PARALLEL)
        ]
        statuses = [f.result() for f in as_completed(futures)]

    assert statuses.count(201) == 1, f"Expected exactly 1×201, got {statuses.count(201)}"
    assert statuses.count(409) == PARALLEL - 1
```

The test needs:
- A running booking-service with Postgres (via Docker Compose)
- A seeded room in `room_snapshots` (via sync or direct insert)
- Auth bypass or test token

Provide fixtures in `conftest.py` for `booking_service_url` and `seeded_room_id` that set up the test environment (insert a room_snapshot row directly via `db_conn`).

- [ ] **Step 2: Run concurrency test**

Run: `make test-integration` (or `cd services/booking-service && python -m pytest tests/integration/test_concurrency.py -v`)
Expected: PASS — exactly 1 × 201, 9 × 409

- [ ] **Step 3: Commit**

```bash
git add services/booking-service/tests/integration/test_concurrency.py
git commit -m "test(booking): add concurrency integration test for double-booking prevention"
```

---

## Post-Plan: Verify & Wire Up

After all 5 tasks:

1. Run `docker compose up --build -d --wait` — all containers healthy
2. Run `make migrate` — migration 0002 applied
3. Run `make lint && make test` — all pass
4. Run `make test-integration` — concurrency test passes
5. Verify via Swagger: `http://localhost:8080/api/bookings/docs`
6. Update `docs/progress.md`: tasks 14–18 → ✅
7. Open PR from feature branch, CI green, squash merge
