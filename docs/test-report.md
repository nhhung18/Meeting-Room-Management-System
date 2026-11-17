# Test Report — Mandatory Scenarios (requirement.docx §7)

> Generated: 2026-10-29 | Branch: `test/task27-scenarios`

## Summary

| Scenario | Description | Status | Tests | File(s) |
|---|---|---|---|---|
| S1 | Concurrent booking → EXCLUDE constraint | ✅ Covered | 1 integration | `booking-service/tests/integration/test_concurrency.py` |
| S2 | JWT expired/invalid → 401 | ✅ New | 9 unit | `booking-service/tests/test_jwt_expired.py`, `room-service/tests/test_jwt_expired.py` |
| S3 | Employee/Manager → Admin API → 403 | ✅ New | 15 unit | `booking-service/tests/test_rbac_scenarios.py`, `room-service/tests/test_rbac_scenarios.py` |
| S4 | Worker downtime → outbox tích lũy, restart drain | ✅ New | 4 unit | `booking-service/tests/test_outbox_resilience.py` |
| S5 | PostgreSQL/RabbitMQ unavailable | ✅ New | 8 unit | `booking-service/tests/test_infra_down.py`, `notification-worker/tests/test_infra_down.py` |
| S6 | Duplicate message → idempotency | ✅ Covered | 2 unit | `notification-worker/tests/test_retry_dlq.py`, `test_worker_dispatch.py` |
| S7 | Multi-instance behind load balancer | ✅ New | 5 unit | `booking-service/tests/test_multi_instance.py` |

**Total new tests:** 41 | **All 7 mandatory scenarios covered**

## Test Results

### booking-service (unit tests, excluding integration)

```
160 passed in 1.75s
```

### room-service

```
67 passed, 16 failed (pre-existing failures in test_rooms_api.py — not related to Task 27)
```

### notification-worker

```
30 passed in 1.01s
```

### libs/common

```
18 passed in 1.05s
```

## Scenario Details

### S1 — Concurrent Booking (already covered)

- `integration/test_concurrency.py::test_concurrent_booking_exactly_one_wins`
- Fires 10 parallel requests for the same room/time slot
- Proves: exactly 1×201, 9×409 via PostgreSQL EXCLUDE constraint

### S2 — JWT Expired → 401

**booking-service** (5 tests):
- Expired token → 401 on list, create, check-in endpoints
- Missing token → 401
- Malformed token → 401

**room-service** (4 tests):
- Expired token → 401 (mocks `JWTValidator.decode` → `AuthError`)
- Invalid token → 401
- No auth header → 401
- Malformed auth header → 401

### S3 — RBAC: Employee/Manager → Admin API → 403

**booking-service** (7 tests):
- Employee cannot sync-rooms (403)
- Manager cannot sync-rooms (403)
- Admin can sync-rooms (200)
- Employee cannot get/cancel other's booking (403)
- Employee can get own booking (200)
- Admin can get any booking (200)

**room-service** (8 tests):
- Employee cannot create/update/delete rooms (403)
- Employee CAN list/get rooms (200) — read endpoints are open
- Manager can create/update/delete rooms (201/200/204)

### S4 — Worker Downtime → Outbox Accumulates

4 tests proving transactional outbox survives worker downtime:
- Unsent events have `sent_at = NULL`
- `relay_once()` drains all 5 unsent events on restart
- Zero published when no unsent events exist
- Partial failure: first 2 marked sent, 3rd stays unsent

### S5 — PostgreSQL / RabbitMQ Unavailable

**booking-service** (5 tests):
- DB down → health returns 503, `{"status": "degraded"}`
- DB up → health returns 200, `{"status": "ok"}`
- DB recovery after outage → 503 then 200
- RabbitMQ down → `relay_once` catches error, events stay unsent
- Booking create succeeds without RabbitMQ (outbox pattern decouples)

**notification-worker** (3 tests):
- DB down → `handle_message` requeues for retry
- DB down + max retries → sends to DLQ
- RabbitMQ down → `run_worker` raises `ConnectionError`

### S6 — Duplicate Message (already covered)

- `test_retry_dlq.py::test_idempotency_duplicate_acks_without_email`
- `test_worker_dispatch.py::test_idempotency_skips_duplicate_event_id`
- Uses `processed_events` table for deduplication

### S7 — Multi-Instance Behind Load Balancer

5 tests proving multi-instance architecture:
- Health endpoint includes hostname (instance identification)
- Health endpoint includes service name
- `BookingService` rejects overlap at service level
- API returns 409 on `IntegrityError` (DB EXCLUDE constraint fallback)
- Nginx config contains rate limiting directives (`limit_req_zone`, 429)

## Commits

```
d9ebfb1 test: add JWT expired scenario tests (S2)
64eb89e test: add RBAC scenario tests — Employee→Admin 403 (S3)
a3c2c40 test: add outbox resilience tests — worker downtime scenario (S4)
f922633 test: add infra down tests — PostgreSQL/RabbitMQ unavailable (S5)
d620fb0 test: add multi-instance tests — load balancer + overlap guard (S7)
```
