# Tiến trình dự án — Meeting Room Management System

> Cập nhật lần cuối: 2026-10-27

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
| 24 | Chạy 2× instance booking-service đằng sau Nginx | ⏳ | Chứng minh stateless |
| 25 | Rate limiting trong Nginx (`limit_req`) | ⏳ | Per-IP |
| 26 | Load test cơ bản | ⏳ | |

## Tuần 7: Test scenarios & Frontend

| # | Task | Trạng thái | Ghi chú |
|---|---|---|---|
| 27 | Test scenarios bắt buộc (theo đề bài) | ⏳ | |
| 28 | Frontend React + TypeScript: trang đặt phòng | ⏳ | |
| 29 | Frontend: trang quản lý phòng (admin) | ⏳ | |
| 30 | Frontend: trang lịch sử / báo cáo | ⏳ | |

## Tuần 8: Hoàn thiện & Demo

| # | Task | Trạng thái | Ghi chú |
|---|---|---|---|
| 31 | Nhật ký kiểm toán (audit log — FR-08) | ⏳ | Chưa quyết định nơi lưu |
| 32 | API docs hoàn chỉnh (Swagger) | ⏳ | |
| 33 | README hướng dẫn chạy + kiến trúc | ⏳ | |
| 34 | Demo video | ⏳ | |
| 35 | Slides thuyết trình | ⏳ | |
