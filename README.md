# Meeting Room Management System

Hệ thống quản lý và đặt phòng họp cho doanh nghiệp: tìm phòng trống, đặt / sửa / hủy lịch, check-in, tự động hủy khi không check-in, thông báo bất đồng bộ qua message queue.

Dự án thực tập 2026, xây dựng theo hướng microservices gần chuẩn production.

## Trạng thái hiện tại

Đang ở **tuần 1, Walking Skeleton**: bộ khung chạy được từ đầu đến cuối, chưa có tính năng nghiệp vụ.

| Thành phần | Trạng thái |
|---|---|
| Nginx (API Gateway) | ✅ Routing, request ID, access log JSON |
| Booking Service | ✅ `/health` có kiểm tra DB, logging JSON, request ID |
| PostgreSQL | ✅ Database + user riêng cho từng service |
| CI (GitHub Actions) | ✅ Lint, unit test, smoke test bằng Docker Compose |
| Room Service | ⏳ Tuần 2 |
| Auth0 (SSO, JWT, RBAC) | ⏳ Tuần 2 |
| RabbitMQ + Notification Worker | ⏳ Tuần 1–5 |
| Frontend React | ⏳ |

## Kiến trúc

```
Trình duyệt ──► Nginx (:8080) ──► booking-service ──► PostgreSQL (booking_db)
                  │                                       (room_db cho room-service)
                  └─ sinh X-Request-ID, chuyển kèm mọi request
```

Chi tiết các quyết định kiến trúc nằm trong [`docs/adr/`](docs/adr/).

## Tech stack

| Lớp | Công nghệ |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Pydantic, Alembic |
| Database | PostgreSQL 16 |
| Gateway / Load balancer | Nginx |
| Message queue | RabbitMQ |
| Auth | Auth0 (OAuth 2.0 / OIDC, JWT, RBAC) |
| Frontend | React, TypeScript |
| Hạ tầng | Docker, Docker Compose, GitHub Actions |

## Chạy dự án

Yêu cầu: Docker và Docker Compose.

```bash
cp .env.example .env          # rồi đổi các mật khẩu trong .env
docker compose up --build
```

Kiểm tra:

```bash
curl http://localhost:8080/health                 # Nginx
curl -i http://localhost:8080/api/bookings/health # Booking Service + DB
```

Swagger UI của Booking Service: <http://localhost:8080/api/bookings/docs>

Các lệnh tắt (xem tất cả bằng `make help`):

| Lệnh | Tác dụng |
|---|---|
| `make up` | Build và chạy nền, chờ mọi service healthy |
| `make logs` | Xem log |
| `make down` | Dừng hệ thống, giữ dữ liệu |
| `make reset-db` | Xóa dữ liệu Postgres, khởi tạo lại |

## Phát triển

### Cài môi trường lần đầu

```bash
cd services/booking-service
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pip install pre-commit && pre-commit install   # chạy ở thư mục gốc repo
```

### Chạy test và lint

```bash
make test
make lint
make format   # tự sửa format
```

### Quy trình Git

- Không commit thẳng vào `main`. Mỗi việc một nhánh:
  `feat/<tên>`, `fix/<tên>`, `chore/<tên>`, `docs/<tên>`, `test/<tên>`.
- Commit theo [Conventional Commits](https://www.conventionalcommits.org/):
  `feat(booking): create booking endpoint`, `fix(room): ...`, `docs: ...`.
- Mỗi nhánh mở Pull Request, liên kết issue (`Closes #12`), chỉ merge khi CI xanh và đã tự review theo checklist trong PR template.

## Cấu trúc thư mục

```
.
├── .github/                 # CI workflow, PR template, issue template
├── docs/adr/                # Architecture Decision Records
├── infra/
│   ├── nginx/nginx.conf     # Gateway: routing, request ID
│   └── postgres/init/       # Tạo database + user cho từng service
├── services/
│   └── booking-service/
│       ├── app/
│       │   ├── api/         # Router (≈ Controller)
│       │   ├── core/        # Config, logging, request ID
│       │   ├── db/          # Kết nối SQLAlchemy
│       │   └── main.py
│       ├── tests/
│       ├── Dockerfile
│       └── pyproject.toml   # Cấu hình ruff, pytest
├── docker-compose.yml
├── .env.example
└── Makefile
```

## Tài liệu

- [Architecture Decision Records](docs/adr/)
- Tài liệu yêu cầu: file `.docx` trong repo
