# CLAUDE.md — Hệ thống quản lý phòng họp (MRMS)

Tập tin này là nguồn thông tin chính thức cho bất kỳ AI agent nào làm việc trong repository này.
Đọc kỹ trước khi hành động. Cập nhật khi có quyết định, trạng thái, hoặc quy ước thay đổi
trong cùng một PR.

Cập nhật lần cuối: 2026-10-19 (ADR-0004 + libs/common)

---

## 1. Dự án tại một cái nhìn

- **Là gì:** Ứng dụng web để đặt phòng họp công ty: tìm phòng trống, đặt / sửa /
  hủy, check-in, hủy tự động khi không check-in, thông báo bất đồng bộ, báo cáo quản trị viên, nhật ký kiểm toán.
- **Tại sao:** Dự án thực tập 2026 (InternshipBlueOC). Được chấm điểm dựa trên kiến trúc, xử lý
  tính toán song song, bảo mật, kiểm thử, DevOps và khả năng **biện minh cho từng lựa chọn kỹ thuật**.
- **Nhóm:** một developer (Hùng), ~8 tuần, bắt đầu 2026-10-05.
- **Yêu cầu:** `Internship Program_ Meeting Room Management System – Hệ thống quản lý phòng họp.docx`
  trong thư mục gốc repo. Bị git-ignore có chủ ý (tài liệu nội bộ, repo là public). Không bao giờ commit.
- **Remote:** https://github.com/nhhung18/Meeting-Room-Management-System (public)

## 2. Cách làm việc với user

- **Ngôn ngữ:** trả lời bằng **tiếng Việt**. Code, identifiers, commit messages và tên file
  giữ nguyên **tiếng Anh**.
- **Nền tảng:** thành thạo Java / Spring Boot; mới tìm hiểu Python, FastAPI, Docker, CI.
  Giải thích khái niệm mới bằng cách so sánh với các thành phần Spring tương ứng
  (FastAPI ≈ Spring Boot, SQLAlchemy ≈ JPA, Alembic ≈ Flyway, Pydantic ≈ Bean Validation).
- **Vai trò:** đóng vai mentor / kiến trúc sư cấp cao, không chỉ là code generator.
  - Khi quyết định kiến trúc hoặc data model, trình bày 2–3 phương án kèm trade-off và
    **để user quyết định**. Sau đó ghi lại quyết định thành ADR.
  - Mỗi đề xuất phải trả lời: *rủi ro nào được giải quyết?* và *điều gì xảy ra nếu thành phần
    này hỏng?*
  - Nêu ra các giả định sai lầm và khoảng trống một cách thẳng thắn nhưng tôn trọng.
- **Code viết phải hiểu được bởi user**, người phải biện minh cho nó trong review.
  Comment giải thích **tại sao**, không phải **cái gì**. Ưu tiên đơn giản hơn thông minh.

## 3. Kiến trúc

```
Trình duyệt ──► Nginx :8080 (API gateway) ──► booking-service :8000 ──► PostgreSQL (booking_db)
                │                         └─► room-service :8000    ──► PostgreSQL (room_db)    [tuần 2]
                │                                        │
                │                                  RabbitMQ ──► notification-worker              [tuần 1–5]
                └─ thêm X-Request-ID vào mỗi request
Auth0 (external): cấp phát JWT; từng service xác thực JWT và RBAC riêng.
```

| Thành phần | Trạng thái | Ghi chú |
|---|---|---|
| `libs/common` | ✅ | shared logging, request_id, config base class |
| `services/booking-service` | ✅ skeleton | FastAPI, `/health`, JSON logs, request ID; dùng libs/common |
| `services/room-service` | ⏳ tuần 2 | cùng layout như booking-service |
| `services/notification-worker` | ✅ skeleton | dùng libs/common; consumer RabbitMQ `notifications` queue; health `/api/notifications/health` |
| `infra/nginx/nginx.conf` | ✅ | routing; rate limiting hoãn đến tuần 6 |
| `infra/postgres/init/` | ✅ | tạo một DB + một user cho từng service |
| RabbitMQ | ✅ | trong compose; management UI :15672 khi local |
| Auth0 | ⏳ tuần 2 | roles: Employee, Room Manager, Administrator |
| `frontend/` (React + TS) | ⏳ | xây dựng tăng dần từ tuần 3, ~1 ngày/tuần |

**Chỉ Nginx công khai port cho host (8080).** Services và Postgres chỉ có thể gọi được
bên trong Docker network.

### Layout bên trong từng service (làm theo mẫu này cho mỗi service mới)

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

## 4. Quyết định

### Đã chấp nhận (xem `docs/adr/`)

| ADR | Quyết định | Hệ quả chính |
|---|---|---|
| 0001 | Nginx là API gateway; không có service gateway riêng | Từng service xác thực JWT riêng; rate limit chỉ per-IP |
| 0002 | Một Postgres server, **một database + một user cho từng service**; `REVOKE CONNECT FROM PUBLIC` | Không cross-service JOIN hoặc FK; chia sẻ data chỉ qua API hoặc events |
| 0003 | Booking lấy Room data qua **Event-Driven Snapshots**: Room publish events, Booking giữ `room_snapshots` table local, JOIN với `bookings` | Eventual consistency (~100ms); Booking tiếp tục khi Room down; tái dùng RabbitMQ |
| 0004 | **`libs/common`** internal package cho logging, config, request_id (và JWT task #12) | Mỗi service Dockerfile COPY libs/common + pip install; build context = project root |

Những lựa chọn đã quyết định khác (chưa có ADR):
- **Git workflow:** GitHub Flow. Chỉ `main` + nhánh sống ngắn. **Không có nhánh `develop`.**
  Environments ánh xạ tới `main` (dev) và version tags (demo), không phải nhánh.
- **SQLAlchemy sync** (không async) để đơn giản. Xem lại chỉ khi có bằng chứng.
- **Rate limiting:** hoãn đến tuần 6 (`limit_req` trong Nginx).

### Chưa quyết định: KHÔNG cài đặt cho đến khi user xác nhận

- **Nơi worker hủy tự động không check-in sống:** đề xuất là process riêng của
  booking-service (cùng codebase, container riêng) vì nó sở hữu `bookings`. Quyết định tuần 5.
- **Nơi nhật ký kiểm toán (FR-08) được lưu.** Mở.

### Các giả định kinh doanh (đề xuất, chưa xác nhận; cần viết vào `docs/assumptions.md`)

1. Khoảng đặt là half-open `[start, end)`: 09–10 và 10–11 không trùng.
2. Kiểm tra dung tích: số người tham dự ≤ dung tích phòng.
3. Phòng chuyển sang MAINTENANCE: đặt trong tương lai không bị hủy tự động; chủ sở hữu
   được thông báo; đặt mới bị chặn.
4. Lưu tất cả timestamps dạng UTC `timestamptz`; hiển thị dạng Asia/Saigon.
5. Đặt không thể bắt đầu ở quá khứ.
6. Cửa sổ check-in mở 15 phút trước start; hủy tự động 15 phút sau start nếu chưa check-in.

### Kế hoạch xử lý song song (triển khai tuần 3–4, thiết kế cho nó bây giờ)

Ngăn chặn double booking bằng **PostgreSQL exclusion constraint** làm bảo vệ cuối cùng,
cộng với pre-check cấp ứng dụng để thông báo lỗi thân thiện. Trả về **409 Conflict** khi vi phạm.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
WHERE (status IN ('CONFIRMED', 'CHECKED_IN'));
```

Locks trong process vô dụng: booking-service sẽ chạy ≥ 2 instances đằng sau Nginx.
Thêm constraint này trong **migration đầu tiên** tạo `bookings`.
Test bắt buộc: bắn N đặt giống nhau song parallel → đúng 1 × 201, N−1 × 409.

## 5. Trạng thái hiện tại (cập nhật mục này mỗi phiên)

- ✅ Walking skeleton chạy local: postgres, booking-service và nginx healthy;
  `curl localhost:8080/api/bookings/health` → 200.
- ✅ **Foundation đã lên `main`**: PR #2 (`chore/project-foundation`) đã merge (bằng merge commit,
  chưa tuân quy ước squash — rút kinh nghiệm cho các PR sau). Fix healthcheck IPv6 (`d9b72be`,
  dùng `127.0.0.1`) đã nằm trong `main`. `origin/main` đồng bộ.
- 🔄 **Đang làm — nhánh `docs/data-model`**: task 3–5 (ADR-0003, `assumptions.md`, `erd.md`) +
  việt hóa tên job CI + ignore `.codegraph/`. Chờ push → PR → **squash** merge → xóa nhánh.
- 🔄 **Đang làm — nhánh `feat/booking-alembic`**: task #6 — Alembic scaffold + migration 0001
  (bookings, booking_attendees, room_snapshots, EXCLUDE constraint, partial indexes) + integration tests.
  `make migrate` và `make test-integration` hoạt động trong Docker.
- ✅ **Nhánh `feat/libs-common`**: task #8 done (committed `9f0d89e`). Chưa merge — đang chờ `feat/booking-alembic` merge trước.
- 🔄 **Đang làm — nhánh `feat/rabbitmq-worker`** (base từ `feat/libs-common`): task #7 — RabbitMQ + notification-worker skeleton.
- ⏳ Sau khi merge `docs/data-model` và `feat/booking-alembic`: bật GitHub ruleset `protect-main`.
- ⏳ Chưa làm: GitHub Project board và labels.

## 6. Roadmap: các task còn lại tuần 1–2

| # | Task | Xong khi | Bị chặn bởi |
|---|---|---|---|
| 3 | ✅ ADR-0003 (biên giới dữ liệu phòng) | ADR chấp nhận | — |
| 4 | ✅ `docs/assumptions.md` (6 giả định kinh doanh) | Tất cả giả định có code examples | — |
| 5 | ✅ `docs/erd.md` (Mermaid + chi tiết tables) | bookings, booking_attendees, room_snapshots, rooms; EXCLUDE constraint; partial indexes | — |
| 6 | ✅ Alembic trong booking-service + migration đầu (`bookings`, `booking_attendees`, `room_snapshots`, constraint loại trừ) | `alembic upgrade head` hoạt động trong Docker; integration tests 3/3 | 5 |
| 7 | ✅ RabbitMQ trong compose + notification-worker skeleton | worker log thông báo test với `request_id` | — |
| 8 | ✅ ADR-0004 + `libs/common` package + refactor booking-service | ADR accepted; libs/common tests 7/7; booking-service unit tests 6/6 | — |
| 9 | room-service skeleton + route `/api/rooms/` trong Nginx + job CI | `/api/rooms/health` → 200 qua Nginx | 8 |
| 10 | Room CRUD + equipment + soft delete + status | Swagger hoạt động; unit + integration tests | 9 |
| 11 | ⏳ Auth0 tenant: API, 3 roles, test users | lấy được tokens theo role | — |
| 12 | JWT validation + RBAC trong services | 401 (không/token hết hạn), 403 (sai role), có tests | 11 |
| 13 | Seed data | `make seed` tạo demo rooms/users | 10 |

Sau đó: tuần 3–4 booking core và song parallel; tuần 5 check-in, hủy tự động, thông báo
(retry, DLQ, idempotency, transactional outbox); tuần 6 2× instance booking + rate limit;
tuần 7 test scenarios bắt buộc + frontend; tuần 8 docs, demo video, slides.

## 7. Lệnh

```bash
cp .env.example .env                 # lần đầu; không bao giờ commit .env
docker compose up --build -d --wait  # khởi động tất cả, chờ cho đến khi healthy
docker compose ps                    # trạng thái
docker compose logs -f booking-service
docker compose down                  # dừng, giữ dữ liệu
docker compose down -v               # dừng VÀ xóa Postgres (chạy lại DB init script)
curl -i http://localhost:8080/api/bookings/health
# Swagger: http://localhost:8080/api/bookings/docs

make help | make test | make lint | make format
make migrate              # chạy alembic upgrade head trong Docker (booking_db)
make test-integration     # chạy integration tests trong Docker (yêu cầu postgres đang chạy)
pre-commit install && pre-commit run --all-files
```

Unit tests chạy không cần database (`database_is_healthy` bị override trong `tests/conftest.py`).
Integration tests (`-m integration`) yêu cầu Postgres + migration; dùng `make test-integration`.

## 8. Quy ước (không thương lượng)

- **Không bao giờ push tới `main`.** Một nhánh cho một task: `feat/…`, `fix/…`, `chore/…`, `docs/…`,
  `test/…`, `ci/…`. Giữ nhánh sống ngắn (≤ 3 ngày). Một mối quan tâm mỗi PR.
- **Conventional Commits:** `feat(booking): create booking endpoint`,
  `fix(infra): …`, `docs: …`. Chữ thường, không dấu chấm ở cuối.
- **PRs:** điền template (mục đích, thay đổi, cách xác minh), liên kết issue
  (`Closes #N`), merge bằng **Squash and merge** chỉ khi CI xanh.
- **Secrets:** tất cả config qua biến môi trường (`app/core/config.py`,
  pydantic-settings). Không hard-code hoặc commit secrets. `.env`, `*.docx`, `*.zip` được git-ignore.
- **Style:** `ruff` (lint + format), dài dòng 100, Python 3.12. Pre-commit bắt buộc.
- **Tests:** mỗi quy tắc business mới có unit test; DB behavior có integration test.
- **Logging:** JSON qua `app/core/logging.py`; mỗi dòng log mang `request_id`.
  Truyền `X-Request-ID` tới các HTTP calls hạ tầng và RabbitMQ messages.
- **Database:** UTC `timestamptz`; soft delete qua `deleted_at`; thay đổi schema chỉ qua
  Alembic migrations, không bao giờ bằng tay.
- **Architecture decisions** vào `docs/adr/NNNN-title.md` dùng template trong
  `docs/adr/README.md`. ADRs chấp nhận không bao giờ edit; thay thế bằng ADR mới.

## 9. Cạm bẫy đã biết (đã gặp lần trước)

| Triệu chứng | Nguyên nhân | Sửa |
|---|---|---|
| `PermissionError: /app/app/__init__.py`, container restart | Host files không world-readable; container chạy non-root `appuser` | `COPY --chown=appuser:appuser` trong Dockerfile (đã làm); `chmod -R go+rX` trên file mới |
| `pip … Read timed out` khi build | Mạng chậm trên dev machine | `PIP_DEFAULT_TIMEOUT=120`, `PIP_RETRIES=10` trong Dockerfile (đã làm); chỉ chạy lại |
| Healthcheck fail trong alpine image | `localhost` → IPv6 `::1` | Dùng `127.0.0.1` trong healthchecks |
| Booking không log in vào Postgres sau edit `.env` | DB init script chỉ chạy trên volume trống | `docker compose down -v` |
| CI hiển thị "Checks 0" | Workflow file không ở `.github/workflows/` trong repo root | Di chuyển tới repo root |
| `/api/bookings/health` → 502 sau `docker compose up` | Nginx `upstream` block cache IP lúc khởi động; container recreate → IP mới | Dùng `set $var http://hostname` + `proxy_pass $var` (đã làm); `resolver 127.0.0.11` bắt buộc |

## 10. Định nghĩa xong cho bất kỳ thay đổi nào

1. Chạy local với `docker compose up --build -d --wait`; tất cả containers healthy.
2. `make lint` và `make test` pass.
3. Behavior mới có tests; README / ADR / file này cập nhật nếu bị ảnh hưởng.
4. PR mở từ feature branch, CI xanh, diff tự review, squash-merge.
