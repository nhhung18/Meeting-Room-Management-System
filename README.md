# Meeting Room Management System (MRMS)

Hệ thống quản lý và đặt phòng họp cho doanh nghiệp — xây dựng theo kiến trúc microservices,
hỗ trợ đặt phòng, check-in, hủy tự động, thông báo bất đồng bộ và báo cáo quản trị.

> Dự án thực tập 2026 — InternshipBlueOC.

---

## Mục tiêu

Xây dựng hệ thống **production-ready** cho phép:

- Nhân viên tìm phòng trống, đặt / sửa / hủy lịch họp, check-in xác nhận
- Room Manager quản lý phòng, thiết bị, trạng thái bảo trì
- Administrator theo dõi báo cáo, nhật ký kiểm toán, quản lý người dùng & chính sách

Trọng tâm đánh giá: kiến trúc, xử lý đồng thời (concurrency), bảo mật, kiểm thử, DevOps
và khả năng **biện minh cho từng lựa chọn kỹ thuật**.

---

## Kiến trúc

```
┌─────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│ Browser  │────►│ Nginx :8080  │────►│ booking-service  │────►│ PostgreSQL   │
│ React+TS │     │ API Gateway  │     │ FastAPI :8000    │     │ (booking_db) │
└─────────┘     │              │     └────────┬─────────┘     └──────────────┘
                │              │              │
                │              │     ┌────────▼─────────┐     ┌──────────────┐
                │              │────►│ room-service      │────►│ PostgreSQL   │
                │              │     │ FastAPI :8000     │     │ (room_db)    │
                └──────────────┘     └────────┬─────────┘     └──────────────┘
                                              │
                                     ┌────────▼─────────┐
                                     │ RabbitMQ          │
                                     │ Message Broker    │
                                     └────────┬─────────┘
                                              │
                                     ┌────────▼──────────────┐
                                     │ notification-worker    │
                                     │ Async Consumer         │
                                     └───────────────────────┘

Auth0 (external): cấp JWT → mỗi service tự xác thực JWT + RBAC
Nginx: thêm X-Request-ID vào mọi request để tracing xuyên suốt
```

**Chỉ Nginx (port 8080) được expose ra host.** Tất cả services và databases chỉ giao tiếp
qua Docker internal network.

Chi tiết các quyết định kiến trúc: [`docs/adr/`](docs/adr/)

---

## Tech Stack

| Lớp | Công nghệ |
|---|---|
| **Frontend** | React 18, TypeScript, Ant Design, Vite |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic |
| **Database** | PostgreSQL 16 (mỗi service một database riêng) |
| **Authentication** | Auth0 (OAuth 2.0 / OIDC, RS256 JWT, RBAC) |
| **Message Queue** | RabbitMQ (async notifications, event-driven snapshots) |
| **API Gateway** | Nginx (routing, request ID injection, rate limiting) |
| **Infrastructure** | Docker, Docker Compose, GitHub Actions CI |
| **Code Quality** | Ruff (lint + format), pre-commit hooks, pytest |

---

## Tính năng (Functional Requirements)

### FR-01 · Quản lý phòng họp
- CRUD phòng họp: tên, vị trí, sức chứa, thiết bị (projector, whiteboard, VC…)
- Trạng thái phòng: `AVAILABLE` / `MAINTENANCE`
- Soft delete — phòng bị xóa không mất dữ liệu lịch sử
- Chỉ **Room Manager** và **Administrator** có quyền quản lý

### FR-02 · Đặt phòng họp
- Tìm phòng trống theo khoảng thời gian, sức chứa, thiết bị
- Đặt phòng với tiêu đề, mô tả, danh sách người tham dự
- Ngăn chặn double-booking bằng **PostgreSQL exclusion constraint** + application-level pre-check
- Trả về **409 Conflict** khi trùng lịch; chạy đúng với ≥ 2 instances đồng thời

### FR-03 · Hủy đặt phòng
- Người đặt hoặc Admin có thể hủy booking đang `CONFIRMED` hoặc `CHECKED_IN`
- Hủy = soft state change (`CANCELLED`), không xóa record

### FR-04 · Check-in
- Cửa sổ check-in: **15 phút trước → 15 phút sau** giờ bắt đầu
- Ngoài cửa sổ → từ chối check-in
- **Tự động hủy** nếu không check-in sau 15 phút kể từ `start_at`

### FR-05 · Thông báo bất đồng bộ
- Gửi qua RabbitMQ → notification-worker xử lý
- Thông báo khi: đặt thành công, bị hủy, sắp đến giờ họp (reminder), phòng chuyển bảo trì
- Retry mechanism + Dead Letter Queue cho message thất bại

### FR-06 · Quản lý người dùng & phân quyền
- 3 vai trò: **Employee**, **Room Manager**, **Administrator**
- Auth0 quản lý identity; JWT mang role claims
- RBAC enforce tại từng service endpoint

| Vai trò | Quyền |
|---|---|
| Employee | Xem phòng, đặt/sửa/hủy booking của mình, check-in |
| Room Manager | + Quản lý phòng, thiết bị, xem booking phòng mình quản lý |
| Administrator | + Toàn quyền: quản lý user, xem báo cáo, nhật ký kiểm toán, chính sách |

### FR-07 · Báo cáo & thống kê (Admin)
- Dashboard: tổng booking, tỷ lệ check-in, tỷ lệ hủy
- Top phòng được đặt nhiều nhất
- Thống kê theo ngày, giờ cao điểm
- Lọc theo khoảng thời gian (7 ngày / 30 ngày / quý)

### FR-08 · Nhật ký kiểm toán (Audit Log)
- Ghi lại mọi thao tác: tạo/sửa/hủy booking, thay đổi phòng, thay đổi quyền
- Mỗi entry: actor, action, target, timestamp, `request_id` (tracing)
- Chỉ Administrator được xem; không thể sửa/xóa

---

## Chạy dự án

### Yêu cầu

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- File `.env` (copy từ `.env.example`)

### Khởi động

```bash
# 1. Tạo file cấu hình
cp .env.example .env          # sửa passwords / Auth0 config trong .env

# 2. Build và chạy toàn bộ hệ thống
docker compose up --build -d --wait

# 3. Kiểm tra tất cả services healthy
docker compose ps
```

> **Lý tưởng chỉ cần `docker compose up`** — mọi database, migration, service đều tự khởi tạo.

### Kiểm tra nhanh

```bash
curl http://localhost:8080/health                   # Nginx gateway
curl -i http://localhost:8080/api/bookings/health   # Booking Service + DB
curl -i http://localhost:8080/api/rooms/health      # Room Service + DB
```

### Giao diện

| URL | Mô tả |
|---|---|
| `http://localhost:3000` | Frontend (React) |
| `http://localhost:8080/api/bookings/docs` | Swagger UI — Booking Service |
| `http://localhost:8080/api/rooms/docs` | Swagger UI — Room Service |
| `http://localhost:15672` | RabbitMQ Management (dev only) |

### Makefile shortcuts

```bash
make help              # xem tất cả lệnh
make up                # build + chạy nền, chờ healthy
make down              # dừng, giữ dữ liệu
make logs              # xem log realtime
make migrate           # chạy Alembic migrations
make test              # unit tests (không cần DB)
make test-integration  # integration tests (cần Postgres)
make lint              # kiểm tra code style
make format            # tự động sửa format
make reset-db          # xóa DB volumes, khởi tạo lại từ đầu
```

---

## Cấu trúc dự án

```
.
├── frontend/                    # React + TypeScript + Ant Design
│   ├── src/
│   │   ├── api/                 # API client modules
│   │   ├── components/          # Shared UI components
│   │   ├── context/             # Auth, Language contexts
│   │   ├── pages/               # Route pages (Dashboard, Bookings, Rooms, Reports…)
│   │   └── types/               # TypeScript interfaces
│   └── Dockerfile
├── services/
│   ├── booking-service/         # Quản lý đặt phòng, check-in, auto-cancel, audit, reports
│   │   ├── app/
│   │   │   ├── api/             # Routers         (≈ @RestController)
│   │   │   ├── services/        # Business logic  (≈ @Service)
│   │   │   ├── repositories/    # DB queries      (≈ Repository)
│   │   │   ├── models/          # SQLAlchemy ORM  (≈ @Entity)
│   │   │   ├── schemas/         # Pydantic DTOs
│   │   │   ├── core/            # Config, logging, security, audit
│   │   │   ├── db/              # Engine, session
│   │   │   └── workers/         # Auto-cancel worker, room event consumer
│   │   ├── alembic/             # Database migrations
│   │   └── tests/
│   ├── room-service/            # Quản lý phòng, thiết bị, trạng thái
│   │   ├── app/                 # (cùng layout với booking-service)
│   │   ├── alembic/
│   │   └── tests/
│   └── notification-worker/     # Consumer RabbitMQ, gửi thông báo
├── libs/common/                 # Shared package: logging, request_id, config
├── infra/
│   ├── nginx/nginx.conf         # API gateway config
│   └── postgres/init/           # DB init scripts (1 database + 1 user per service)
├── docs/
│   ├── adr/                     # Architecture Decision Records
│   ├── erd.md                   # Entity Relationship Diagram
│   ├── assumptions.md           # Business assumptions
│   └── progress.md              # Development progress tracker
├── .github/                     # CI workflows, PR/issue templates
├── docker-compose.yml
├── Makefile
└── .env.example
```

---

## Phát triển

### Cài đặt môi trường local

```bash
# Backend (mỗi service)
cd services/booking-service
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt

# Frontend
cd frontend
npm install

# Pre-commit hooks (chạy ở thư mục gốc repo)
pip install pre-commit && pre-commit install
```

### Kiểm thử

```bash
make test               # Unit tests — không cần database
make test-integration   # Integration tests — cần Postgres đang chạy
make lint               # Ruff lint check
```

**Yêu cầu kiểm thử theo requirement:**
- Unit test cho mọi business rule
- Integration test cho database behavior (constraints, overlaps)
- Concurrency test: N requests song song → đúng 1 × 201, (N-1) × 409
- Test RBAC: 401 (thiếu token), 403 (sai role)

### Quy trình Git

- **GitHub Flow:** chỉ `main` + feature branches ngắn (≤ 3 ngày)
- Nhánh: `feat/…`, `fix/…`, `chore/…`, `docs/…`, `test/…`, `ci/…`
- **Conventional Commits:** `feat(booking): create booking endpoint`
- PR: squash merge khi CI xanh, liên kết issue (`Closes #N`)

---

## Xử lý đồng thời (Concurrency)

Ngăn chặn double-booking bằng **PostgreSQL exclusion constraint** — bảo vệ ở tầng database,
không phụ thuộc vào application lock (vô dụng khi chạy ≥ 2 instances):

```sql
ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
) WHERE (status IN ('CONFIRMED', 'CHECKED_IN'));
```

Application pre-check cung cấp thông báo lỗi thân thiện trước khi constraint reject.

---

## Tài liệu

| Tài liệu | Mô tả |
|---|---|
| [`docs/adr/`](docs/adr/) | Architecture Decision Records |
| [`docs/erd.md`](docs/erd.md) | Entity Relationship Diagram (Mermaid) |
| [`docs/assumptions.md`](docs/assumptions.md) | Business assumptions & rules |
| [`docs/progress.md`](docs/progress.md) | Development progress tracker |
| [`docs/auth0-setup.md`](docs/auth0-setup.md) | Auth0 tenant setup guide |

---

## License

Internal project — InternshipBlueOC 2026.
