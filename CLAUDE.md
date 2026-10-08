# CLAUDE.md — Meeting Room Management System (MRMS)

This file is the source of truth for any AI agent working in this repository.
Read it fully before acting. Keep it current: when a decision, status, or convention
changes, update the relevant section in the same PR.

Last updated: 2026-10-09

---

## 1. Project at a glance

- **What:** Web app for booking company meeting rooms: search free rooms, book / edit /
  cancel, check-in, auto-cancel on no-show, async notifications, admin reports, audit log.
- **Why:** 2026 internship project (InternshipBlueOC). Graded on architecture, concurrency,
  security, testing, DevOps and the ability to **justify every technical choice**.
- **Team:** one developer (Hùng), ~8 weeks, started 2026-10-05.
- **Requirements:** `Internship Program_ Meeting Room Management System – Hệ thống quản lý phòng họp.docx`
  in the repo root. It is git-ignored on purpose (internal document, repo is public). Never commit it.
- **Remote:** https://github.com/nhhung18/Meeting-Room-Management-System (public)

## 2. How to work with the user

- **Language:** reply in **Vietnamese**. Code, identifiers, commit messages and file
  names stay in English.
- **Background:** strong in Java / Spring Boot; new to Python, FastAPI, Docker, CI.
  Explain new concepts by mapping them to Spring equivalents
  (FastAPI ≈ Spring Boot, SQLAlchemy ≈ JPA, Alembic ≈ Flyway, Pydantic ≈ Bean Validation).
- **Role:** act as a senior architect / mentor, not just a code generator.
  - For architecture or data-model decisions, present 2–3 options with trade-offs and
    **let the user decide**. Then record the decision as an ADR.
  - Every proposal must answer: *what risk does this solve?* and *what happens if this
    component crashes?*
  - Point out flawed assumptions and gaps candidly and respectfully.
- **Code you write must be understandable by the user**, who has to defend it in review.
  Comment the *why*, not the *what*. Prefer simple over clever.

## 3. Architecture

```
Browser ──► Nginx :8080 (API gateway) ──► booking-service :8000 ──► PostgreSQL (booking_db)
                 │                     └─► room-service :8000    ──► PostgreSQL (room_db)    [week 2]
                 │                                    │
                 │                              RabbitMQ ──► notification-worker              [week 1–5]
                 └─ adds X-Request-ID to every request
Auth0 (external): issues JWT; each service validates JWT and RBAC itself.
```

| Component | Status | Notes |
|---|---|---|
| `services/booking-service` | ✅ skeleton | FastAPI, `/health`, JSON logs, request ID |
| `services/room-service` | ⏳ week 2 | same layout as booking-service |
| `services/notification-worker` | ⏳ | consumes RabbitMQ |
| `infra/nginx/nginx.conf` | ✅ | routing; rate limiting deferred to week 6 |
| `infra/postgres/init/` | ✅ | creates one DB + one user per service |
| RabbitMQ | ⏳ week 1 (task #7) | |
| Auth0 | ⏳ week 2 | roles: Employee, Room Manager, Administrator |
| `frontend/` (React + TS) | ⏳ | build incrementally from week 3, ~1 day/week |

**Only Nginx publishes a port to the host (8080).** Services and Postgres are reachable
only inside the Docker network.

### Service internal layout (follow it for every new service)

```
app/
├── api/           # routers            (≈ @RestController)
├── services/      # business logic     (≈ @Service)
├── repositories/  # DB queries         (≈ Repository)
├── models/        # SQLAlchemy models  (≈ @Entity)
├── schemas/       # Pydantic DTOs
├── core/          # config, logging, request_id, security
├── db/            # engine / session
└── main.py
```

## 4. Decisions

### Accepted (see `docs/adr/`)

| ADR | Decision | Key consequence |
|---|---|---|
| 0001 | Nginx is the API gateway; no separate gateway service | Each service validates JWT itself; rate limit is per-IP only |
| 0002 | One Postgres server, **one database + one user per service**; `REVOKE CONNECT FROM PUBLIC` | No cross-service JOIN or FK; share data only via API or events |

Other settled choices (no ADR yet):
- **Git workflow:** GitHub Flow. Only `main` plus short-lived branches. **No `develop` branch.**
  Environments map to `main` (dev) and version tags (demo), not to branches.
- **SQLAlchemy sync** (not async) for simplicity. Revisit only with evidence.
- **Rate limiting:** deferred to week 6 (`limit_req` in Nginx).

### Pending: do NOT implement until the user confirms

- **ADR-0003: how Booking gets room data (status, capacity, equipment).**
  Recommended **option B**: Room Service publishes `RoomCreated/RoomUpdated` events to
  RabbitMQ; Booking keeps a local `room_snapshots` table (only fields it needs + `version`).
  Rationale: booking keeps working when Room Service is down; FR-03 search becomes one SQL
  query; reuses RabbitMQ. Ignore events with `version` ≤ stored version (idempotency /
  ordering). Initial sync via Room API on empty table.
  Alternative A: synchronous HTTP call to Room Service (simpler, but booking fails when Room is down).
  **Status: user has not yet replied "ok B".** Ask before building on it.
- **Sharing JWT/logging code between services:** copy vs `libs/common` package vs Nginx
  `auth_request`. Decide in week 2 (ADR-0004).
- **Where the no-check-in auto-cancel worker lives:** proposed as a separate process of
  booking-service (same codebase, own container) since it owns `bookings`. Decide in week 5.
- **Where audit logs (FR-08) are stored.** Open.

### Business assumptions (proposed, not yet confirmed; to be written to `docs/assumptions.md`)

1. Booking interval is half-open `[start, end)`: 09–10 and 10–11 do not overlap.
2. Capacity check: number of attendees ≤ room capacity.
3. Room switched to MAINTENANCE: future bookings are not auto-cancelled; owners are
   notified; new bookings are blocked.
4. Store all timestamps as UTC `timestamptz`; display in Asia/Saigon.
5. Bookings cannot start in the past.
6. Check-in window opens 15 min before start; auto-cancel 15 min after start if not checked in.

### Concurrency plan (implement in weeks 3–4, design for it now)

Prevent double booking with a **PostgreSQL exclusion constraint** as the final guard,
plus an application-level pre-check for friendly errors. Return **409 Conflict** on violation.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
WHERE (status IN ('CONFIRMED', 'CHECKED_IN'));
```

In-process locks are useless: booking-service will run ≥ 2 instances behind Nginx.
Add this constraint in the **first** migration that creates `bookings`.
Required test: fire N concurrent identical bookings → exactly 1 × 201, N−1 × 409.

## 5. Current status (update this section every session)

- ✅ Walking skeleton runs locally: postgres, booking-service and nginx are healthy;
  `curl localhost:8080/api/bookings/health` → 200.
- 🔄 **PR #2** `chore/project-foundation` → `main` is **open, not merged**.
  - CI did not run at first because the CI files were extracted into a sub-folder. Fixed
    locally: `.github/`, `Makefile`, `.pre-commit-config.yaml` are now in the repo root.
  - First CI run failed: `container mrms-nginx-1 is unhealthy`. Cause: healthcheck used
    `localhost`, which resolves to IPv6 `::1` in alpine while Nginx listens on IPv4 only.
    Fixed in `docker-compose.yml` (now `http://127.0.0.1/health`).
    **Not yet committed/pushed. Verify with `git status`.**
  - Stray file `bug ci docker compose .txt` in repo root: delete it, do not commit.
- ⏳ After PR #2 is green and merged: `git switch main && git pull`, then enable the GitHub
  ruleset `protect-main` (require PR, **required approvals = 0** because solo, require both
  CI checks, block force-push). Allow squash merge only; auto-delete head branches.
- ⏳ Not done yet: GitHub Project board and labels.

## 6. Roadmap: remaining week-1 and week-2 tasks

| # | Task | Done when | Blocked by |
|---|---|---|---|
| 3 | ADR-0003 (room data boundary) | ADR accepted | user confirmation |
| 4 | `docs/assumptions.md` | each assumption has a one-line decision | user confirmation |
| 5 | `docs/erd.md` (Mermaid) for `room_db` and `booking_db` | PK, unique, index, constraints shown; `bookings.room_id` is **not** an FK | 3, 4 |
| 6 | Alembic in booking-service + first migration (`bookings`, `booking_attendees`, `room_snapshots` if B, exclusion constraint) | `alembic upgrade head` works in Docker | 5 |
| 7 | RabbitMQ in compose + notification-worker skeleton | worker logs a test message carrying the same `request_id` | — |
| 8 | ADR-0004: shared code strategy | ADR accepted | — |
| 9 | room-service skeleton + `/api/rooms/` route in Nginx + CI job | `/api/rooms/health` → 200 via Nginx | 8 |
| 10 | Room CRUD + equipment + soft delete + status | Swagger works; unit + integration tests | 9 |
| 11 | Auth0 tenant: API, 3 roles, test users | tokens obtainable per role | — |
| 12 | JWT validation + RBAC in services | 401 (no/expired token), 403 (wrong role), with tests | 11 |
| 13 | Seed data | `make seed` creates demo rooms/users | 10 |

Later: weeks 3–4 booking core and concurrency; week 5 check-in, auto-cancel, notifications
(retry, DLQ, idempotency, transactional outbox); week 6 2× booking instances + rate limit;
week 7 mandatory test scenarios + frontend; week 8 docs, demo video, slides.

## 7. Commands

```bash
cp .env.example .env                 # first time only; never commit .env
docker compose up --build -d --wait  # start everything, wait until healthy
docker compose ps                    # status
docker compose logs -f booking-service
docker compose down                  # stop, keep data
docker compose down -v               # stop AND wipe Postgres (re-runs DB init script)
curl -i http://localhost:8080/api/bookings/health
# Swagger: http://localhost:8080/api/bookings/docs

make help | make test | make lint | make format
pre-commit install && pre-commit run --all-files
```

Unit tests run without a database (`database_is_healthy` is overridden in `tests/conftest.py`).

## 8. Conventions (non-negotiable)

- **Never push to `main`.** One branch per task: `feat/…`, `fix/…`, `chore/…`, `docs/…`,
  `test/…`, `ci/…`. Keep branches short-lived (≤ 3 days). One concern per PR.
- **Conventional Commits:** `feat(booking): create booking endpoint`,
  `fix(infra): …`, `docs: …`. Lower-case subject, no trailing period.
- **PRs:** fill the template (purpose, changes, how to verify), link the issue
  (`Closes #N`), merge with **Squash and merge** only when CI is green.
- **Secrets:** all config via environment variables (`app/core/config.py`,
  pydantic-settings). Never hard-code or commit secrets. `.env`, `*.docx`, `*.zip` are git-ignored.
- **Style:** `ruff` (lint + format), line length 100, Python 3.12. Pre-commit enforces it.
- **Tests:** every new business rule gets a unit test; DB behaviour gets an integration test.
- **Logging:** JSON via `app/core/logging.py`; every log line carries `request_id`.
  Propagate `X-Request-ID` to downstream HTTP calls and RabbitMQ messages.
- **Database:** UTC `timestamptz`; soft delete via `deleted_at`; schema changes only via
  Alembic migrations, never by hand.
- **Architecture decisions** go into `docs/adr/NNNN-title.md` using the template in
  `docs/adr/README.md`. Accepted ADRs are never edited; supersede them with a new ADR.

## 9. Known pitfalls (already hit once)

| Symptom | Cause | Fix |
|---|---|---|
| `PermissionError: /app/app/__init__.py`, container restarting | Host files not world-readable; container runs as non-root `appuser` | `COPY --chown=appuser:appuser` in Dockerfile (done); `chmod -R go+rX` on new files |
| `pip … Read timed out` during build | Slow network on the dev machine | `PIP_DEFAULT_TIMEOUT=120`, `PIP_RETRIES=10` in Dockerfile (done); just re-run |
| Healthcheck fails in alpine image | `localhost` → IPv6 `::1` | Use `127.0.0.1` in healthchecks |
| Booking can't log in to Postgres after editing `.env` | DB init script only runs on an empty volume | `docker compose down -v` |
| CI shows "Checks 0" | Workflow file not at `.github/workflows/` in repo root | Move it to the root |

## 10. Definition of done for any change

1. Runs locally with `docker compose up --build -d --wait`; all containers healthy.
2. `make lint` and `make test` pass.
3. New behaviour has tests; README / ADR / this file updated if affected.
4. PR opened from a feature branch, CI green, diff self-reviewed, squash-merged.
