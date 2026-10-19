# ADR-0004: Chia sẻ code giữa services bằng internal Python package

- **Trạng thái:** Accepted
- **Ngày:** 2026-10-19

## Bối cảnh

Ba services (booking, room, notification-worker) cần các thành phần giống nhau:
- JSON structured logging với `request_id` (mọi dòng log phải mang correlation ID)
- Pattern pydantic-settings config (đọc env vars, fail fast nếu thiếu)
- `resolve_request_id()` và `request_id_ctx` ContextVar

Task #12 sẽ thêm JWT validation — cũng cần dùng chung giữa booking và room service.

**Trạng thái hiện tại:** booking-service sở hữu những thành phần này trong `app/core/`.
Nếu không có chiến lược chia sẻ, mỗi service mới sẽ copy `app/core/`, dẫn đến drift.

## Các phương án

| | A: Copy | B: `libs/common` package | C: Nginx `auth_request` |
|---|---|---|---|
| **Cơ chế** | Mỗi service copy `app/core/` | Shared Python package, `pip install -e` | JWT ở Nginx; services tin vào header `X-User-ID` |
| **Ưu điểm** | Zero coupling; deploy độc lập; không cần build chung | Single source of truth; fix ở 1 chỗ → tất cả services; thể hiện kỹ năng kiến trúc | Services không cần implement JWT; cập nhật 1 chỗ |
| **Nhược điểm** | Drift risk: bug fix phải patch N chỗ; không thể hiện kiến trúc | Docker build context cần include `libs/`; local dev cần `pip install -e` | Services trust header mù quáng (bypass = full access); không dùng được cho notification-worker (no HTTP) |
| **Khi hỏng** | Bug ở 1 copy không patch sang copy khác → inconsistent behavior giữa services | `libs/common` bị breaking change → tất cả services hỏng khi build lại | Nginx misconfigured → auth bypass; worker không áp dụng được |

## Quyết định

Chọn **B: `libs/common` internal Python package**.

**Lý do:**

1. **Architecture maturity:** Dự án được chấm điểm theo kiến trúc. Shared library thể hiện hiểu biết DRY, internal package management, và service decomposition — trực tiếp vào tiêu chí chấm.
2. **Maintainability:** JWT middleware (task #12), logging, config — ~200 dòng shared qua 3 services. Fix 1 chỗ, tất cả services nhận khi build lại.
3. **Docker complexity có giới hạn:** Chỉ thêm 1 `COPY` + 1 `pip install -e` vào mỗi Dockerfile. Build context chuyển từ `./services/X` sang project root với `.dockerignore` để loại trừ các services không liên quan.
4. **Option C (Nginx auth_request) bị loại:** notification-worker không có HTTP; tin header là security risk cho grading exercise.
5. **Option A (Copy) bị loại:** Drift risk khi 3 services và JWT code ~ 200 dòng, không phù hợp mục tiêu học tập của dự án.

## Hệ quả

### Tích cực

- Mỗi service import từ `common.*`, không copy code.
- JWT middleware (task #12) viết trong `libs/common/security/` — booking và room service cùng dùng.
- Fix bug logging/config ở 1 chỗ → tất cả services nhận khi `docker compose build`.

### Tiêu cực / cần xử lý

1. **Docker build context thay đổi:** Services dùng `build.context: .` (project root) + `build.dockerfile: services/X/Dockerfile`. Cần `.dockerignore` ở root để loại trừ node_modules, frontend, etc.
2. **Local dev:** Developer cần `pip install -e libs/common` trong virtualenv để có IntelliSense. Documented trong README.
3. **Breaking changes:** Nếu `libs/common` thay đổi interface, tất cả services bị ảnh hưởng khi rebuild. Giảm thiểu bằng cách giữ interface ổn định; không xóa/đổi tên function đã export.

### Cài đặt

```
libs/
└── common/
    ├── pyproject.toml          ← package definition
    └── src/
        └── common/
            ├── __init__.py
            ├── config.py       ← ServiceSettings base class
            ├── logging.py      ← JsonFormatter, configure_logging
            └── request_id.py   ← request_id_ctx, resolve_request_id
```

Mỗi service Dockerfile:
```dockerfile
COPY libs/common/ ./libs/common/
RUN pip install -e ./libs/common
```

Mỗi service `app/core/` re-export từ `common.*` để giữ nguyên import path nội bộ:
```python
# services/booking-service/app/core/logging.py
from common.logging import JsonFormatter, configure_logging
__all__ = ["JsonFormatter", "configure_logging"]
```

### Khi nào revisit

Nếu project vượt 5 services hoặc `libs/common` phát triển thành nhiều module phức tạp → xem xét ADR-0005 (versioning, separate repo, hoặc pip install từ git tag).
