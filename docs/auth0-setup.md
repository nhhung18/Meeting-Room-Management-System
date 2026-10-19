# Auth0 Setup Guide — MRMS

Tài liệu này hướng dẫn tạo Auth0 tenant cho dự án Meeting Room Management System.
Sau khi hoàn thành, bạn sẽ lấy được JWT token theo từng role để test.

---

## Tổng quan

| Thành phần | Mô tả |
|---|---|
| **Tenant** | Không gian cô lập cho MRMS trên Auth0 |
| **API** | Resource Server mà các service sẽ validate token |
| **Roles** | Employee, Room Manager, Administrator |
| **Applications** | SPA (frontend), M2M (test/CI) |

---

## Bước 1 — Tạo Auth0 account và tenant

1. Truy cập https://auth0.com → Sign up (miễn phí, không cần thẻ tín dụng)
2. Chọn **Create Tenant** → đặt tên `mrms-dev` (hoặc tuỳ ý)
3. Region: **US** (hoặc gần nhất)
4. Ghi lại domain: `mrms-dev.auth0.com` → điền vào `.env`:
   ```
   AUTH0_DOMAIN=mrms-dev.auth0.com
   ```

---

## Bước 2 — Tạo API (Resource Server)

1. Auth0 Dashboard → **Applications → APIs → + Create API**
2. Điền:
   - **Name:** `MRMS API`
   - **Identifier:** `https://mrms.api`  ← đây là `AUTH0_AUDIENCE`
   - **Signing Algorithm:** `RS256`
3. Tab **Settings** → bật **Enable RBAC** và **Add Permissions in the Access Token**
4. Tab **Permissions** → thêm các permissions:

   | Permission | Description |
   |---|---|
   | `read:rooms` | Xem danh sách phòng |
   | `write:bookings` | Tạo/sửa/hủy booking |
   | `read:bookings` | Xem booking |
   | `manage:rooms` | Thêm/sửa/xóa phòng (Room Manager) |
   | `admin:reports` | Xem báo cáo admin |
   | `admin:users` | Quản lý users |

5. Điền vào `.env`:
   ```
   AUTH0_AUDIENCE=https://mrms.api
   ```

---

## Bước 3 — Tạo Roles

1. **User Management → Roles → + Create Role**

   Tạo lần lượt 3 roles:

   | Role | Permissions |
   |---|---|
   | `Employee` | `read:rooms`, `write:bookings`, `read:bookings` |
   | `Room Manager` | tất cả của Employee + `manage:rooms` |
   | `Administrator` | tất cả + `admin:reports`, `admin:users` |

2. Với mỗi role: sau khi tạo → tab **Permissions** → **Add Permissions** → chọn API `MRMS API` → tick các permission tương ứng

---

## Bước 4 — Tạo Test Users

1. **User Management → Users → + Create User**

   | Email | Password | Role |
   |---|---|---|
   | `employee@test.mrms` | `Test@12345` | Employee |
   | `manager@test.mrms` | `Test@12345` | Room Manager |
   | `admin@test.mrms` | `Test@12345` | Administrator |

2. Sau khi tạo mỗi user → tab **Roles** → **Assign Roles** → gán role tương ứng

---

## Bước 5 — Tạo Applications

### 5a. Machine-to-Machine Application (dùng để test lấy token trong terminal)

1. **Applications → Applications → + Create Application**
   - **Name:** `MRMS M2M (Test)`
   - **Type:** Machine to Machine Applications
2. Màn hình tiếp: chọn API `MRMS API` → **All** permissions → **Authorize**
3. Tab **Settings** → copy **Client ID** và **Client Secret** → điền `.env`:
   ```
   AUTH0_M2M_CLIENT_ID=<Client ID>
   AUTH0_M2M_CLIENT_SECRET=<Client Secret>
   ```

### 5b. Single Page Application (dùng cho frontend tuần 3+)

1. **Applications → + Create Application**
   - **Name:** `MRMS Web`
   - **Type:** Single Page Application
2. Tab **Settings**:
   - **Allowed Callback URLs:** `http://localhost:3000/callback`
   - **Allowed Logout URLs:** `http://localhost:3000`
   - **Allowed Web Origins:** `http://localhost:3000`
3. Ghi lại Client ID (không cần Secret với SPA)

---

## Bước 6 — Bật "Add Roles to Tokens" bằng Action

Auth0 không tự động thêm roles vào JWT. Cần thêm một Action:

1. **Actions → Flows → Login**
2. Click **+** → **Build Custom** → đặt tên `Add Roles to Token`
3. Code:
   ```javascript
   exports.onExecutePostLogin = async (event, api) => {
     const namespace = 'https://mrms.api';
     if (event.authorization) {
       api.idToken.setCustomClaim(`${namespace}/roles`, event.authorization.roles);
       api.accessToken.setCustomClaim(`${namespace}/roles`, event.authorization.roles);
     }
   };
   ```
4. **Deploy** → kéo Action vào flow → **Apply**

---

## Bước 7 — Verify: lấy token và kiểm tra

Sau khi setup xong, chạy script để lấy token:

```bash
# Lấy M2M token (để test API endpoints)
scripts/get-token.sh m2m

# Lấy user token theo role (Resource Owner Password — chỉ dùng khi local/test)
scripts/get-token.sh employee
scripts/get-token.sh manager
scripts/get-token.sh admin
```

Decode token tại https://jwt.io — kiểm tra payload có:
- `aud`: `["https://mrms.api", ...]`
- `https://mrms.api/roles`: `["Employee"]` (hoặc role tương ứng)
- `iss`: `https://mrms-dev.auth0.com/`

---

## Troubleshooting

| Vấn đề | Giải pháp |
|---|---|
| Token không có roles | Kiểm tra Action đã Deploy và kéo vào Login flow chưa |
| `401 Unauthorized` khi decode | Kiểm tra `AUTH0_DOMAIN` đúng format (không có `https://`) |
| Permission không có trong token | Bật "Add Permissions in the Access Token" trong API settings |
| M2M token không có user roles | Đúng rồi — M2M token không có user roles, chỉ có permissions |
