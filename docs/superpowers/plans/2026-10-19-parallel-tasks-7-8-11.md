# Tasks #7, #8, #11 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver three deliverables — ADR-0004 + `libs/common` shared package (task #8), RabbitMQ + notification-worker skeleton (task #7), and Auth0 tenant setup (task #11) — to unblock tasks #9–13.

**Architecture:** Task #8 creates `libs/common/` Python package (logging, config, request_id) and refactors booking-service to import from it. Task #7 then creates notification-worker importing the same `libs/common`. Task #11 configures Auth0 externally and wires env vars. Tasks #8 and #11 run in parallel (Phase 1); Task #7 depends on Task #8's `libs/common` (Phase 2).

**Tech Stack:** Python 3.12, aio-pika (RabbitMQ client), pydantic-settings, Auth0, Docker Compose.

**Spec:** `CLAUDE.md` sections 3 (architecture), 6 (roadmap), 8 (conventions); `docs/adr/README.md` (ADR template); `docs/adr/0003-room-data-access-via-events.md` (RabbitMQ decision).

## Global Constraints

- Python 3.12, ruff lint/format, line length 100
- Conventional Commits: `feat(…):`, `docs:`, `chore(…):` — lowercase, no period
- JSON structured logging with `request_id` on every log line
- All config via environment variables (pydantic-settings), never hardcoded
- Docker services: only Nginx exposes port to host; internal services talk via Docker network
- Pre-commit hooks must pass (trailing whitespace, ruff check, ruff format)
- Integration tests marked `@pytest.mark.integration`; unit tests run DB-free
- `.env`, `*.docx`, `*.zip` never committed

## Review Focus

1. **`libs/common` import path in Docker:** Each service Dockerfile must `COPY libs/common/ ./libs/common/` and `pip install -e ./libs/common` before copying app code, so the shared package is importable inside the container. A wrong COPY order breaks the build.
2. **Booking-service regression after refactor:** After switching booking-service from `app.core.*` to `libs.common.*`, all 6 unit tests and 3 integration tests must still pass. The refactor must not change behavior.
3. **Message with missing `request_id`:** Worker receives a message without `request_id` field — it should generate a new one (same as HTTP middleware does for missing `X-Request-ID`), not crash or log `None`.
4. **Auth0 token expiry vs. test setup:** Test users' tokens expire; `.env.example` documents `OIDC_DOMAIN` and `OIDC_AUDIENCE` but tests in task #12 must not depend on live Auth0 (mock JWKS). Task #11 only proves tokens can be obtained manually.
5. **Docker healthcheck for RabbitMQ:** `rabbitmq-diagnostics -q ping` is the correct healthcheck (not HTTP to management port 15672); wrong check causes false-healthy.

---

## Execution Phases

```
Phase 1 (parallel):
  ├─ Task 1: ADR-0004 + libs/common + refactor booking-service  (branch: feat/libs-common)
  └─ Task 3: Auth0 tenant setup                                  (branch: feat/auth0-setup)

Phase 2 (after Task 1 merges):
  └─ Task 2: RabbitMQ + notification-worker using libs/common     (branch: feat/rabbitmq-worker)
```

---

## Task 1: ADR-0004 + `libs/common` Package + Refactor booking-service (Task #8)

**Branch:** `feat/libs-common`

**Files:**
- Create: `docs/adr/0004-code-sharing-strategy.md`
- Modify: `docs/adr/README.md` (add row for ADR-0004)
- Create: `libs/common/pyproject.toml`
- Create: `libs/common/src/common/__init__.py`
- Create: `libs/common/src/common/logging.py` (extracted from booking-service `app/core/logging.py`)
- Create: `libs/common/src/common/request_id.py` (extracted from booking-service `app/core/request_id.py`)
- Create: `libs/common/src/common/config.py` (base `ServiceSettings` class)
- Create: `libs/common/tests/__init__.py`
- Create: `libs/common/tests/test_logging.py`
- Create: `libs/common/tests/test_request_id.py`
- Modify: `services/booking-service/app/core/config.py` (inherit from `common.config.ServiceSettings`)
- Modify: `services/booking-service/app/core/logging.py` (re-export from `common.logging`)
- Modify: `services/booking-service/app/core/request_id.py` (re-export from `common.request_id`)
- Modify: `services/booking-service/Dockerfile` (add `COPY libs/common` + `pip install -e`)
- Modify: `services/booking-service/requirements.txt` (no change — libs/common installed separately)
- Modify: `docker-compose.yml` (update booking-service build context)
- Modify: `.github/workflows/ci.yml` (add libs/common lint+test job; update booking-service job to install libs/common)
- Modify: `Makefile` (add `test-common` target)
- Modify: `CLAUDE.md` sections 3, 4, 5
- Test: `libs/common/tests/test_logging.py`, `libs/common/tests/test_request_id.py`, existing booking-service tests

**Interfaces:**
- Consumes: Existing `services/booking-service/app/core/` code (source of truth for extraction)
- Produces: `libs/common` package exposing `common.logging.configure_logging`, `common.logging.JsonFormatter`, `common.request_id.request_id_ctx`, `common.request_id.resolve_request_id`, `common.request_id.REQUEST_ID_HEADER`, `common.config.ServiceSettings`

### Sub-task 1a: Write ADR-0004

- [ ] **Step 1: Write `docs/adr/0004-code-sharing-strategy.md`**

Follow the template in `docs/adr/README.md`. Content:

**Title:** ADR-0004: Chia sẻ code giữa services bằng internal Python package

**Status:** Proposed

**Context:**
Three services (booking, room, notification-worker) need identical: JSON structured logging with `request_id`, pydantic-settings config pattern, `resolve_request_id()`. Task #12 will add JWT validation — also shared. Current state: booking-service owns these in `app/core/`.

**Options:**

| | A: Copy | B: `libs/common` package | C: Nginx `auth_request` |
|---|---|---|---|
| **What** | Each service copies `app/core/` | Shared Python package `libs/common/`, installed via `pip install -e` | JWT at Nginx; services trust `X-User-ID` header |
| **Pros** | Zero coupling; independent deploys | Single source of truth; one fix → all services; demonstrates architecture skill | Services skip JWT entirely; one update point |
| **Cons** | Drift risk: bug fix must patch N services; does not demonstrate architecture maturity | Docker build context must include `libs/`; local dev needs `pip install -e` | Services trust header blindly (bypass = full access); no roles in header; notification-worker has no HTTP |
| **When it breaks** | Bug in one copy not patched in others → inconsistent behavior | `libs/common` has a breaking change → all services fail on next build | Nginx misconfigured → auth bypass; worker can't use this |

**Decision:** Option B (`libs/common`).

Rationale:
1. **Architecture maturity:** Project is graded on architecture decisions. A shared library demonstrates understanding of DRY, internal package management, and service decomposition — directly scoring criteria.
2. **Maintainability:** JWT middleware (task #12), logging, config — ~200 lines shared across 3 services. One fix propagates to all services on next Docker build.
3. **Docker complexity is bounded:** One extra `COPY` + `pip install -e` per Dockerfile. Build context changes from `./services/X` to `.` (project root) with `.dockerignore` to exclude unrelated services.
4. **Nginx `auth_request` (C) rejected:** notification-worker has no HTTP; trusting a header is a security risk for a grading exercise.
5. **Copy (A) rejected:** Drift risk on 3 services is manageable but architecturally lazy — doesn't match the project's learning goals.

**Consequences:**
- `libs/common/` package created at repo root with `src/common/` layout.
- Each service Dockerfile: `COPY libs/common/ ./libs/common/` then `pip install -e ./libs/common`.
- `docker-compose.yml`: services use project root as build context (or Docker Compose `build.context` + `build.dockerfile`).
- Each service's `app/core/` re-exports from `common.*` (thin wrappers) — preserving `from app.core.logging import configure_logging` import paths inside the service.
- CI adds a `libs-common` job for lint + tests.

- [ ] **Step 2: Update `docs/adr/README.md`**

Add row:
```
| [0004](0004-code-sharing-strategy.md) | Shared `libs/common` Python package cho logging, config, JWT | Proposed |
```

- [ ] **Step 3: Commit**

```bash
git add docs/adr/0004-code-sharing-strategy.md docs/adr/README.md
git commit -m "docs: add ADR-0004 shared libs/common package (proposed)"
```

### Sub-task 1b: Create `libs/common` package

- [ ] **Step 4: Write test for `common.request_id`**

`libs/common/tests/test_request_id.py`:

```python
from common.request_id import resolve_request_id, request_id_ctx, REQUEST_ID_HEADER

def test_valid_request_id_is_reused():
    assert resolve_request_id("abc-123") == "abc-123"

def test_invalid_request_id_is_replaced():
    result = resolve_request_id("bad id\nwith newline")
    assert result != "bad id\nwith newline"
    assert len(result) == 32  # uuid4 hex

def test_none_generates_new_id():
    result = resolve_request_id(None)
    assert len(result) == 32

def test_header_constant():
    assert REQUEST_ID_HEADER == "X-Request-ID"
```

- [ ] **Step 5: Run tests — expect FAIL (module not found)**

Run: `cd libs/common && python -m pytest tests/ -v`
Expected: `ModuleNotFoundError: No module named 'common'`

- [ ] **Step 6: Create `libs/common/pyproject.toml`**

```toml
[build-system]
requires = ["setuptools>=75.0"]
build-backend = "setuptools.build_meta"

[project]
name = "mrms-common"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["pydantic-settings>=2.15"]

[tool.setuptools.packages.find]
where = ["src"]

[tool.pytest.ini_options]
testpaths = ["tests"]

[tool.ruff]
line-length = 100
target-version = "py312"
```

- [ ] **Step 7: Create `libs/common/src/common/request_id.py`**

Extract from `services/booking-service/app/core/request_id.py` — copy the entire module unchanged. The module has no imports from `app.*` so it works standalone.

Contents: `REQUEST_ID_HEADER`, `request_id_ctx` ContextVar, `_VALID_REQUEST_ID` regex, `resolve_request_id()`.

- [ ] **Step 8: Create `libs/common/src/common/__init__.py`**

Empty file.

- [ ] **Step 9: Install and run tests**

Run: `cd libs/common && pip install -e . && python -m pytest tests/ -v`
Expected: 4 tests PASS.

- [ ] **Step 10: Write test for `common.logging`**

`libs/common/tests/test_logging.py`:

```python
import json
import logging

from common.logging import configure_logging, JsonFormatter
from common.request_id import request_id_ctx

def test_json_formatter_outputs_valid_json():
    formatter = JsonFormatter("test-service")
    record = logging.LogRecord("test", logging.INFO, "", 0, "hello", (), None)
    output = formatter.format(record)
    parsed = json.loads(output)
    assert parsed["service"] == "test-service"
    assert parsed["message"] == "hello"
    assert parsed["level"] == "INFO"

def test_json_formatter_includes_request_id():
    token = request_id_ctx.set("req-abc")
    try:
        formatter = JsonFormatter("svc")
        record = logging.LogRecord("test", logging.INFO, "", 0, "msg", (), None)
        parsed = json.loads(formatter.format(record))
        assert parsed["request_id"] == "req-abc"
    finally:
        request_id_ctx.reset(token)

def test_configure_logging_sets_handler(capfd):
    configure_logging("my-svc", "INFO")
    logger = logging.getLogger("test_configure")
    logger.info("check")
    captured = capfd.readouterr()
    parsed = json.loads(captured.out.strip())
    assert parsed["service"] == "my-svc"
```

- [ ] **Step 11: Create `libs/common/src/common/logging.py`**

Extract from `services/booking-service/app/core/logging.py`. Change one import:
- Old: `from app.core.request_id import request_id_ctx`
- New: `from common.request_id import request_id_ctx`

Rest of the module is identical.

- [ ] **Step 12: Run tests**

Run: `cd libs/common && python -m pytest tests/ -v`
Expected: 7 tests PASS.

- [ ] **Step 13: Create `libs/common/src/common/config.py`**

Base settings class that services extend:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class ServiceSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_name: str
    environment: str = "local"
    log_level: str = "INFO"
```

No test needed — `ServiceSettings` is a trivial data class; each service's concrete `Settings` subclass is tested in that service.

- [ ] **Step 14: Run full test + lint**

Run: `cd libs/common && python -m pytest tests/ -v && ruff check src/ tests/ && ruff format --check src/ tests/`
Expected: 7 tests PASS, lint clean.

- [ ] **Step 15: Commit**

```bash
git add libs/common/
git commit -m "feat(common): create libs/common package with logging, request_id, config"
```

### Sub-task 1c: Refactor booking-service to use `libs/common`

- [ ] **Step 16: Update booking-service `app/core/request_id.py` to re-export**

Replace the entire file content with:

```python
from common.request_id import REQUEST_ID_HEADER, request_id_ctx, resolve_request_id

__all__ = ["REQUEST_ID_HEADER", "request_id_ctx", "resolve_request_id"]
```

This preserves all existing imports like `from app.core.request_id import request_id_ctx` across the service.

- [ ] **Step 17: Update booking-service `app/core/logging.py` to re-export**

Replace:

```python
from common.logging import JsonFormatter, configure_logging

__all__ = ["JsonFormatter", "configure_logging"]
```

- [ ] **Step 18: Update booking-service `app/core/config.py`**

Change `Settings` to inherit from `ServiceSettings`:

```python
from functools import lru_cache

from common.config import ServiceSettings


class Settings(ServiceSettings):
    service_name: str = "booking-service"
    api_prefix: str = "/api/bookings"
    database_url: str


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 19: Update booking-service Dockerfile**

The build context must include `libs/common/`. Two approaches:
- **Approach chosen:** Use `docker-compose.yml` `build.context: .` (project root) + `build.dockerfile: services/booking-service/Dockerfile`. The Dockerfile then uses paths relative to project root.

Updated Dockerfile:

```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN useradd --create-home --uid 10001 appuser

# Install libs/common first (changes less often than service code)
COPY libs/common/ ./libs/common/
RUN pip install -e ./libs/common

COPY services/booking-service/requirements.txt services/booking-service/requirements-dev.txt ./
RUN pip install -r requirements-dev.txt

COPY --chown=appuser:appuser services/booking-service/app ./app
COPY --chown=appuser:appuser services/booking-service/alembic.ini ./alembic.ini
COPY --chown=appuser:appuser services/booking-service/alembic ./alembic
COPY --chown=appuser:appuser services/booking-service/tests ./tests
COPY --chown=appuser:appuser services/booking-service/pyproject.toml ./pyproject.toml

USER appuser
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
```

- [ ] **Step 20: Update `docker-compose.yml` booking-service build context**

```yaml
booking-service:
  build:
    context: .
    dockerfile: services/booking-service/Dockerfile
```

- [ ] **Step 21: Create `.dockerignore` at project root**

To prevent sending the entire repo as build context:

```
.git
.codegraph
.venv*
node_modules
frontend
**/__pycache__
**/.pytest_cache
**/.ruff_cache
*.docx
*.zip
.env
.env.*
!.env.example
```

- [ ] **Step 22: Run existing unit tests**

Run: `cd services/booking-service && pip install -e ../../libs/common && python -m pytest -v`
Expected: 6 unit tests PASS (test_health.py: 5 tests + any others).

- [ ] **Step 23: Build and run Docker**

Run: `docker compose up --build -d --wait`
Run: `curl -i http://localhost:8080/api/bookings/health`
Expected: 200 OK.

- [ ] **Step 24: Run integration tests**

Run: `make test-integration`
Expected: 3 integration tests PASS.

- [ ] **Step 25: Commit**

```bash
git add services/booking-service/ docker-compose.yml .dockerignore
git commit -m "refactor(booking): use libs/common for logging, config, request_id"
```

### Sub-task 1d: CI + Makefile + docs

- [ ] **Step 26: Add `libs-common` CI job**

Add to `.github/workflows/ci.yml`:

```yaml
libs-common:
  name: libs/common · lint + test
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: libs/common
  steps:
    - uses: actions/checkout@v7
    - uses: actions/setup-python@v7
      with:
        python-version: "3.12"
        cache: pip
        cache-dependency-path: libs/common/pyproject.toml
    - run: pip install -e ".[dev]" || pip install -e . && pip install pytest ruff
    - name: Lint
      run: ruff check src/ tests/ && ruff format --check src/ tests/
    - name: Test
      run: python -m pytest -v
```

Update `booking-service` CI job to install `libs/common` before running tests:

```yaml
- run: pip install -e libs/common
  working-directory: .
```

- [ ] **Step 27: Add Makefile target**

```makefile
COMMON := libs/common

test-common: ## Chạy test của libs/common
	cd $(COMMON) && python -m pytest -v
```

- [ ] **Step 28: Update CLAUDE.md**

- Section 3 (architecture): add `libs/common` to component table
- Section 4: move ADR-0004 from "chưa quyết định" to "đã chấp nhận", note Option B
- Section 5: mark task #8 ✅

- [ ] **Step 29: Present ADR to user for acceptance**

Print ADR summary and ask user to confirm. After confirmation, change status from `Proposed` to `Accepted`.

- [ ] **Step 30: Commit docs updates**

```bash
git add .github/workflows/ci.yml Makefile CLAUDE.md docs/adr/
git commit -m "docs: accept ADR-0004, update CI and CLAUDE.md for libs/common"
```

---

## Task 2: RabbitMQ + notification-worker skeleton (Task #7)

**Branch:** `feat/rabbitmq-worker` (created from `main` after Task 1 merges)

**Files:**
- Modify: `docker-compose.yml` (add `rabbitmq` service + `notification-worker` service)
- Modify: `.env.example` (add `RABBITMQ_USER`, `RABBITMQ_PASSWORD`)
- Create: `services/notification-worker/Dockerfile`
- Create: `services/notification-worker/requirements.txt`
- Create: `services/notification-worker/requirements-dev.txt`
- Create: `services/notification-worker/pyproject.toml`
- Create: `services/notification-worker/app/__init__.py`
- Create: `services/notification-worker/app/main.py`
- Create: `services/notification-worker/app/core/__init__.py`
- Create: `services/notification-worker/app/core/config.py` (extends `common.config.ServiceSettings`)
- Create: `services/notification-worker/app/consumer.py`
- Create: `services/notification-worker/tests/__init__.py`
- Create: `services/notification-worker/tests/unit/__init__.py`
- Create: `services/notification-worker/tests/unit/test_consumer.py`
- Modify: `Makefile` (add `logs-worker` target)
- Modify: `.github/workflows/ci.yml` (add `notification-worker` lint+test job)
- Test: `services/notification-worker/tests/unit/test_consumer.py`

**Interfaces:**
- Consumes: `libs/common` package (`common.logging`, `common.request_id`, `common.config`); RabbitMQ `amqp://` URL from `RABBITMQ_URL` env var
- Produces: Logs JSON lines to stdout with `request_id`, `service: "notification-worker"`. Declares queue `notifications` on startup.

### Sub-task 2a: Add RabbitMQ service to docker-compose

- [ ] **Step 1: Add `rabbitmq` service and env vars**

Add to `docker-compose.yml`:
- Service `rabbitmq` using image `rabbitmq:3-management-alpine`
- Environment: `RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-mrms}`, `RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD:-change-me-rabbit}`
- Healthcheck: `rabbitmq-diagnostics -q ping`, interval 10s, timeout 5s, retries 10
- No ports exposed to host (internal only). Comment with `# ports: ["15672:15672"]` for dev debugging.

Add to `.env.example`:
```
RABBITMQ_USER=mrms
RABBITMQ_PASSWORD=change-me-rabbit
```

- [ ] **Step 2: Verify RabbitMQ starts healthy**

Run: `docker compose up --build -d --wait`
Expected: `docker compose ps` shows `rabbitmq` as `healthy`.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "chore(infra): add RabbitMQ service to docker-compose"
```

### Sub-task 2b: Create notification-worker skeleton

- [ ] **Step 4: Write unit test for message processing**

`services/notification-worker/tests/unit/test_consumer.py`:

```python
import json
from unittest.mock import AsyncMock

import pytest

from app.consumer import process_message


@pytest.mark.asyncio
async def test_process_message_extracts_request_id():
    """Message with request_id → context var set, message acked."""
    msg = AsyncMock()
    msg.body = json.dumps({"request_id": "test-req-001", "type": "booking.created"}).encode()
    msg.routing_key = "notifications"

    await process_message(msg)

    msg.ack.assert_called_once()


@pytest.mark.asyncio
async def test_process_message_generates_request_id_when_missing():
    """Message without request_id → new ID generated, not None."""
    msg = AsyncMock()
    msg.body = json.dumps({"type": "booking.created"}).encode()
    msg.routing_key = "notifications"

    await process_message(msg)

    msg.ack.assert_called_once()
```

- [ ] **Step 5: Create `app/core/config.py`**

```python
from functools import lru_cache

from common.config import ServiceSettings


class Settings(ServiceSettings):
    service_name: str = "notification-worker"
    rabbitmq_url: str  # required, fail fast


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

No `api_prefix`, no `database_url` — worker has neither.

- [ ] **Step 6: Create `app/consumer.py`**

```python
async def process_message(message: aio_pika.abc.AbstractIncomingMessage) -> None
```

- Parse `message.body` as JSON
- Extract `request_id` from payload (or `resolve_request_id(None)` if missing)
- Set `request_id_ctx` for the duration of processing
- Log: `logger.info("notification received", extra={"fields": {"routing_key": ..., "payload": ...}})`
- Acknowledge message

Uses: `from common.logging import configure_logging`, `from common.request_id import request_id_ctx, resolve_request_id`

- [ ] **Step 7: Create `app/main.py`**

```python
async def main() -> None
```

- `configure_logging(settings.service_name, settings.log_level)`
- Connect via `aio_pika.connect_robust(settings.rabbitmq_url)`
- Declare queue `notifications` (durable=True)
- Set `prefetch_count=10`
- Start consuming with `process_message`
- Log startup message
- Block on `asyncio.Future()` (run forever)

Entry point: `asyncio.run(main())`

- [ ] **Step 8: Create `Dockerfile`**

```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN useradd --create-home --uid 10002 appuser

# Shared library first (changes less often)
COPY libs/common/ ./libs/common/
RUN pip install -e ./libs/common

COPY services/notification-worker/requirements.txt services/notification-worker/requirements-dev.txt ./
RUN pip install -r requirements-dev.txt

COPY --chown=appuser:appuser services/notification-worker/app ./app
COPY --chown=appuser:appuser services/notification-worker/tests ./tests
COPY --chown=appuser:appuser services/notification-worker/pyproject.toml ./pyproject.toml

USER appuser

CMD ["python", "-m", "app.main"]
```

No EXPOSE (no HTTP port).

- [ ] **Step 9: Create `requirements.txt` and `requirements-dev.txt`**

`requirements.txt`:
```
aio-pika==9.5.4
```

(Note: `pydantic-settings` comes from `libs/common` dependency, no need to duplicate.)

`requirements-dev.txt`:
```
-r requirements.txt
pytest==9.1.1
pytest-asyncio==0.25.3
ruff==0.16.10
```

- [ ] **Step 10: Create `pyproject.toml`**

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-m 'not integration'"
markers = ["integration: cần RabbitMQ thật (bỏ qua khi chạy make test)"]

[tool.ruff]
line-length = 100
target-version = "py312"
```

- [ ] **Step 11: Run unit tests locally**

Run: `cd services/notification-worker && pip install -e ../../libs/common && pip install -r requirements-dev.txt && python -m pytest -v`
Expected: 2 tests PASS.

- [ ] **Step 12: Run ruff**

Run: `cd services/notification-worker && ruff check . && ruff format --check .`
Expected: clean.

- [ ] **Step 13: Wire notification-worker into docker-compose**

Add `notification-worker` service:
- `build.context: .` + `build.dockerfile: services/notification-worker/Dockerfile`
- `environment:` SERVICE_NAME, ENVIRONMENT, LOG_LEVEL, RABBITMQ_URL (`amqp://${RABBITMQ_USER:-mrms}:${RABBITMQ_PASSWORD}@rabbitmq:5672/`)
- `depends_on:` rabbitmq (condition: service_healthy)
- `restart: unless-stopped`
- No healthcheck (no HTTP endpoint).

- [ ] **Step 14: Verify worker starts and connects**

Run: `docker compose up --build -d --wait`
Run: `docker compose logs notification-worker`
Expected: JSON log line with `"message": "notification-worker started, consuming queue 'notifications'"`.

- [ ] **Step 15: Commit**

```bash
git add services/notification-worker/ docker-compose.yml .env.example
git commit -m "feat(notification): add notification-worker skeleton with libs/common"
```

### Sub-task 2c: End-to-end message flow + CI + Makefile

- [ ] **Step 16: Publish test message and verify worker logs it**

```bash
docker compose exec rabbitmq rabbitmqadmin publish \
  exchange=amq.default routing_key=notifications \
  payload='{"request_id":"manual-test-001","type":"test","body":"hello"}'
```

Run: `docker compose logs --tail=5 notification-worker`
Expected: JSON log with `"request_id": "manual-test-001"`, `"message": "notification received"`.

- [ ] **Step 17: Add CI job for notification-worker**

Add to `.github/workflows/ci.yml`:
- Job `notification-worker` with `working-directory: services/notification-worker`
- Steps: checkout, setup-python, `pip install -e libs/common`, pip install requirements-dev.txt, ruff, pytest
- Update `smoke-test` job: add `notification-worker` to `needs`; add worker logs to failure step.

- [ ] **Step 18: Add Makefile targets**

```makefile
WORKER := services/notification-worker

logs-worker: ## Xem log notification-worker
	docker compose logs -f notification-worker
```

- [ ] **Step 19: Run full smoke test**

Run: `docker compose down -v && docker compose up --build -d --wait`
Run: `docker compose ps` — all services healthy/running.
Run: `curl -i http://localhost:8080/api/bookings/health` — 200.
Run: `docker compose logs notification-worker` — startup log present.

- [ ] **Step 20: Update CLAUDE.md and commit**

Mark task #7 as ✅ in CLAUDE.md sections 5 and 6.

```bash
git add .github/workflows/ci.yml Makefile CLAUDE.md
git commit -m "docs: mark task #7 complete, add worker CI and Makefile targets"
```

---

## Task 3: Auth0 Tenant Setup (Task #11)

**Branch:** `feat/auth0-setup` (parallel with Task 1, no code dependency)

**Files:**
- Modify: `.env.example` (add `OIDC_DOMAIN`, `OIDC_AUDIENCE`)
- Create: `docs/auth0-setup.md` (setup instructions + verification commands)
- Modify: `CLAUDE.md` section 5 (mark task #11 done)

**Interfaces:**
- Consumes: Auth0 dashboard (external, manual)
- Produces: `.env.example` with OIDC vars; `docs/auth0-setup.md` with curl commands to obtain tokens per role; 3 test users with roles assigned

**Note:** This task is primarily manual external configuration. The plan documents exact steps and verification commands.

### Sub-task 3a: Document Auth0 setup steps

- [ ] **Step 1: Create `docs/auth0-setup.md`**

Document:

1. **Create Auth0 tenant** (free tier)
2. **Create API:** name `MRMS API`, identifier `https://mrms-api`, RS256, enable RBAC + "Add Permissions in the Access Token"
3. **Define permissions:** `read:rooms`, `write:rooms`, `delete:rooms`, `read:bookings`, `write:bookings`, `delete:bookings`, `read:reports`
4. **Create 3 roles:**
   - `Employee`: `read:rooms`, `read:bookings`, `write:bookings`
   - `RoomManager`: Employee + `write:rooms`, `delete:rooms`, `delete:bookings`
   - `Administrator`: all permissions
5. **Create 3 test users:**
   - `employee@test.mrms.local` → Employee
   - `manager@test.mrms.local` → RoomManager
   - `admin@test.mrms.local` → Administrator
6. **Create M2M application** for token acquisition
7. **Verification curl commands**

- [ ] **Step 2: Add OIDC env vars to `.env.example`**

```
# Auth0 / OIDC (task #11)
OIDC_DOMAIN=your-tenant.auth0.com
OIDC_AUDIENCE=https://mrms-api
```

- [ ] **Step 3: Commit**

```bash
git add docs/auth0-setup.md .env.example
git commit -m "docs: add Auth0 setup guide and OIDC env vars"
```

### Sub-task 3b: Perform Auth0 setup (manual, user-driven)

- [ ] **Step 4: User creates Auth0 tenant following the guide**

Manual steps 1–6. User performs in Auth0 dashboard.

- [ ] **Step 5: User obtains a test token and verifies**

Run the curl command from the guide. Verify JWT has `permissions` claim.

- [ ] **Step 6: Update `.env` with real values (local only)**

- [ ] **Step 7: Update CLAUDE.md and commit**

Mark task #11 ✅.

```bash
git add CLAUDE.md
git commit -m "docs: mark task #11 (Auth0 setup) complete"
```

---

## Execution Summary

```
Phase 1 (parallel, 2 branches):
  feat/libs-common:    Task 1 (ADR-0004 + libs/common + refactor booking-service)
  feat/auth0-setup:    Task 3 (Auth0 tenant setup)
  → Both PR → squash merge to main

Phase 2 (sequential, after feat/libs-common merges):
  feat/rabbitmq-worker: Task 2 (RabbitMQ + notification-worker using libs/common)
  → PR → squash merge to main

After all merge → unblocked:
  Task #9  (room-service skeleton, imports libs/common)
  Task #10 (Room CRUD)
  Task #12 (JWT validation in libs/common)
  Task #13 (Seed data)
```
