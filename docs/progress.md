# Tiến trình dự án — Meeting Room Management System

> Cập nhật lần cuối: 2026-10-29

## Tuần 1–2: Foundation & Skeleton

| # | Task | Trạng thái | Ghi chú |
|---|---|---|---|
| 1 | Set up cơ bản dự án (Docker Compose, Nginx, Postgres, CI) | ✅ Done | PR #2 merged |
| 2 | CLAUDE.md + quy ước làm việc | ✅ Done | |
| 3 | ADR-0003 (biên giới dữ liệu Room ↔ Booking) | ✅ Done | Event-driven snapshots |
| 4 | `docs/assumptions.md` (6 giả định kinh doanh) | ✅ Done | |
| 5 | `docs/erd.md` (Mermaid ERD + chi tiết tables) | ✅ Done | |
| 6 | Alembic scaffold + migration 0001 (bookings, booking_attendees, room_snapshots, EXCLUDE constraint) | ✅ Done | `make migrate` + integration tests |
| 7 | RabbitMQ trong compose + notification-worker skeleton | ✅ Done | consumer `notifications` queue |
| 8 | ADR-0004 + `libs/common` package + refactor booking-service | ✅ Done | logging, request_id, config |
| 9 | room-service skeleton + Nginx route + CI job | ✅ Done | `/api/rooms/health` → 200 |
| 10 | Room CRUD + equipment + soft delete + status | ✅ Done | Alembic migration, unit + integration tests, Swagger |
| 11 | Auth0 tenant: API, 3 roles, test users | ⏳ | Manual setup |
| 12 | JWT validation + RBAC trong services | ✅ Done | libs/common JWT validator, room-service wired; e2e blocked chờ task 11 |
| 13 | Seed data (`make seed`) | ✅ Done | 11 demo rooms, idempotent; verify Docker manual |

## Tuần 3–4: Booking Core & Xử lý song song

| # | Task | Trạng thái | Ghi chú |
|---|---|---|---|
| 14 | Booking CRUD API (create, read, update, cancel) | ⏳ | |
| 15 | Tích hợp room_snapshots (Booking lấy Room data qua events) | ⏳ | ADR-0003 |
| 16 | Concurrency test: N request song song → 1×201, (N-1)×409 | ⏳ | EXCLUDE constraint |
| 17 | Booking validation (kiểm tra dung tích, thời gian, trùng lịch) | ⏳ | |
| 18 | Phân quyền booking (Employee đặt/hủy của mình, Manager quản lý phòng mình, Admin toàn quyền) | ⏳ | Chờ task 12 |

## Tuần 5: Check-in, Hủy tự động & Thông báo

| # | Task | Trạng thái | Ghi chú |
|---|---|---|---|
| 19 | Check-in API (cửa sổ 15 phút trước start) | ✅ Done | `POST /{id}/check-in`; cửa sổ ±15 phút |
| 20 | Auto-cancel worker (hủy sau 15 phút nếu chưa check-in) | ✅ Done | `python -m app.workers.auto_cancel`; loop 60s |
| 21 | Notification: gửi thông báo khi đặt/hủy/sắp đến giờ | ✅ Done | EmailSender 4 event types; idempotency via `processed_events` |
| 22 | Retry + DLQ + idempotency cho messages | ✅ Done | x-death header; max 3 retries; `notifications.dlq` |
| 23 | Transactional outbox pattern | ✅ Done | `outbox_events` table; relay worker; outbox writes in router + auto_cancel |

## Tuần 6: Scaling & Bảo vệ

| # | Task | Trạng thái | Ghi chú |
|---|---|---|---|
| 24 | Chạy 2× instance booking-service đằng sau Nginx | ✅ Done | `--scale booking-service=2`; resolver valid=1s; health trả hostname |
| 25 | Rate limiting trong Nginx (`limit_req`) | ✅ Done | 20r/s per-IP, burst=40, 429 khi vượt |
| 26 | Load test cơ bản | ✅ Done | `scripts/load-test.py`: concurrent + rate-limit test |

## Tuần 7: Test scenarios & Frontend

| # | Task | Trạng thái | Ghi chú |
|---|---|---|---|
| 27 | Test scenarios bắt buộc (theo đề bài) | ✅ Done | 41 new tests; all 7 scenarios S1–S7 covered; `docs/test-report.md` |
| 28 | Frontend API layer: HTTP client + mappers + rooms/bookings API + error handling | ✅ Done | 6 modules, 51 unit tests; rooms/bookings call backend qua Vite proxy → Nginx; ApiErrorState covers 0/403/404/409/5xx; nhánh `feat/frontend-api-integration` |
| 28b | Frontend missing UI: edit booking flow + ApiErrorState wired | ✅ Done | BookingFormPage edit mode (PATCH), edit button on MyBookingsPage, ApiErrorState + empty state wired vào 4 pages; 51 tests pass |
| 28c | Frontend auth wiring: AuthContext → setTokenProvider + 401 error state | ✅ Done | createTokenProvider() wired vào http.ts; 401 case trong ApiErrorState với vi/en translations; 55 tests pass |
| 29 | Frontend: trang quản lý phòng (admin) | ✅ Done | RoomManagementPage committed (CRUD + error state) |
| 30 | Frontend: trang lịch sử / báo cáo | ⏳ | |

## Functional Requirements (FR)

| FR | Mô tả | Trạng thái | Ghi chú |
|---|---|---|---|
| FR-01 | Auth0 JWT + RBAC 3 roles | 🔄 Partial | libs/common wired; Auth0 tenant chưa config (task 11) |
| FR-02 | Room CRUD + trạng thái + ảnh | ✅ Done | AVAILABLE/MAINTENANCE/DISABLED; Cloudinary upload; PR #18 |
| FR-03 | Availability search + room-service snapshots | ✅ Done | GET /api/bookings/rooms/available; floor/capacity/equipment/time filters; room event consumer; 7 integration tests |
| FR-04 | Booking CRUD + check-in | ✅ Done | Concurrency EXCLUDE constraint; check-in ±window |
| FR-05 | Admin cấu hình runtime policy (check-in window) | ✅ Done | system_policies table; PolicyService cache 60s; PATCH /api/bookings/policies/{key} |
| FR-06 | Thông báo async (booking.created, cancelled, reminders) | ✅ Done | 6 event types; outbox pattern; DLQ; reminder worker; room-outbox-relay |
| FR-07 | Báo cáo quản trị viên | ⏳ | Chưa làm |
| FR-08 | Nhật ký kiểm toán | ⏳ | Chưa quyết định nơi lưu |

## Tuần 8: Hoàn thiện & Demo

| # | Task | Trạng thái | Ghi chú |
|---|---|---|---|
| 31 | Nhật ký kiểm toán (audit log — FR-08) | ⏳ | Chưa quyết định nơi lưu |
| 32 | API docs hoàn chỉnh (Swagger) | ⏳ | |
| 33 | README hướng dẫn chạy + kiến trúc | ⏳ | |
| 34 | Demo video | ⏳ | |
| 35 | Slides thuyết trình | ⏳ | |

## FR requirements

| FR | Item | Trạng thái | Ghi chú |
|---|---|---|---|
| FR-02 | 02-4: ARCHIVED → DISABLED | ✅ Done | room-service migration 0002; booking migration 0005; RoomStatus.DISABLED |
| FR-02 | 02-6: Cloudinary image upload | ✅ Done | `POST /api/rooms/{id}/image`; multipart; validate type/size; migration 0003 adds floor/desc/image_url |
