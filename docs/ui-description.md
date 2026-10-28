# Mô tả giao diện người dùng — Meeting Room Management System

> Cập nhật: 2026-10-28

## Tổng quan

Hệ thống gồm **3 vai trò** với các trang tương ứng:

| Vai trò | Mô tả | Các trang chính |
|---------|-------|-----------------|
| **Employee** | Nhân viên đặt phòng họp | Login, Dashboard, Danh sách phòng, Chi tiết phòng, Đặt phòng, Booking của tôi |
| **Room Manager** | Quản lý phòng được phân công | Tất cả của Employee + Quản lý phòng (CRUD) |
| **Administrator** | Toàn quyền | Tất cả + Lịch sử/Báo cáo, Quản lý người dùng |

**Tech stack frontend:** React 18 + TypeScript + Vite + React Router v6 + Ant Design (hoặc MUI)

---

## 1. Trang Login (`/login`)

**Mục đích:** Xác thực người dùng qua Auth0.

**Giao diện:**
- Logo hệ thống "MRMS" ở giữa trang
- Nút **"Đăng nhập với Auth0"** → redirect tới Auth0 Universal Login
- Sau khi Auth0 callback thành công → lưu JWT vào memory (không localStorage), redirect về Dashboard
- Nếu token hết hạn → tự động redirect về `/login`

**Luồng xử lý:**
```
Người dùng → Nút "Đăng nhập" → Auth0 Universal Login → Callback /callback
→ Lưu access_token (JWT) → Redirect /dashboard
```

**Lưu ý bảo mật:**
- JWT chứa `sub` (user ID), `roles` (`Employee` / `Room Manager` / `Administrator`), `email`
- Dùng `Authorization: Bearer <token>` cho mọi API call
- Dev mode (không set AUTH0_DOMAIN): tự động đăng nhập anonymous Administrator

---

## 2. Layout chung (Sidebar + Header)

**Header (top bar):**
- Logo "MRMS" bên trái
- Tên người dùng + avatar + dropdown menu bên phải
  - Menu: Thông tin cá nhân, Đăng xuất
- Badge thông báo (số notification chưa đọc) — tương lai

**Sidebar (left navigation):**
- Các menu item tùy theo role:

| Menu item | Route | Employee | Room Manager | Admin |
|-----------|-------|----------|--------------|-------|
| Dashboard | `/dashboard` | ✅ | ✅ | ✅ |
| Danh sách phòng | `/rooms` | ✅ | ✅ | ✅ |
| Booking của tôi | `/my-bookings` | ✅ | ✅ | ✅ |
| Quản lý phòng | `/admin/rooms` | ❌ | ✅ | ✅ |
| Lịch sử & Báo cáo | `/admin/reports` | ❌ | ❌ | ✅ |

- Menu item active highlight theo route hiện tại
- Sidebar collapsible (thu gọn icon-only)

---

## 3. Dashboard (`/dashboard`)

**Mục đích:** Tổng quan nhanh cho người dùng sau khi đăng nhập.

### Employee view:
- **Booking sắp tới** (upcoming): Danh sách 3-5 booking tiếp theo (status CONFIRMED)
  - Mỗi card hiển thị: Tên phòng, thời gian, số người, nút **Check-in** (nếu trong cửa sổ ±15 phút)
  - Click card → chi tiết booking
- **Phòng trống ngay** (available now): 3-4 card phòng đang AVAILABLE và chưa có booking giờ hiện tại
  - Click → chuyển tới form đặt phòng

### Admin view (thêm):
- **Thống kê nhanh** (stat cards):
  - Tổng số phòng (AVAILABLE / MAINTENANCE / ARCHIVED)
  - Booking hôm nay (tổng / confirmed / checked-in / cancelled)
  - Tỷ lệ sử dụng phòng hôm nay (%)
- **Booking cần xử lý**: booking quá hạn check-in (sắp bị auto-cancel)

---

## 4. Danh sách phòng (`/rooms`)

**Mục đích:** Nhân viên tìm và chọn phòng trống để đặt.

**API:** `GET /api/rooms/?status=AVAILABLE&q=&limit=20&offset=0`

**Giao diện:**

### Thanh filter (trên cùng):
- **Ô tìm kiếm**: Tìm theo tên phòng (param `q`)
- **Lọc trạng thái**: Dropdown `Tất cả / Đang hoạt động / Bảo trì / Lưu trữ`
  - Employee chỉ thấy AVAILABLE
  - Admin/Manager thấy tất cả
- **Lọc sức chứa**: Dropdown `≥ 5 người / ≥ 10 người / ≥ 20 người`
- **Lọc thiết bị**: Multi-select chips `TV / Máy chiếu / Camera / Microphone / Whiteboard`

### Danh sách (grid cards hoặc table):

**Card view** (mặc định):
```
┌─────────────────────────────┐
│  [Ảnh phòng / placeholder]  │
│                             │
│  Meeting Room A             │
│  👥 Sức chứa: 10 người     │
│  🟢 Đang hoạt động          │
│  📋 TV, Máy chiếu, Camera  │
│                             │
│  [Xem chi tiết]  [Đặt ngay]│
└─────────────────────────────┘
```

Mỗi card hiển thị:
- **Ảnh phòng** (placeholder nếu chưa có image) — 16:9 ratio
- **Tên phòng** (bold)
- **Sức chứa**: `{capacity} người`
- **Trạng thái**: badge màu (xanh=AVAILABLE, vàng=MAINTENANCE, xám=ARCHIVED)
- **Thiết bị**: danh sách chips/tags
- **Nút hành động**:
  - "Xem chi tiết" → `/rooms/{id}`
  - "Đặt ngay" → `/rooms/{id}/book` (chỉ khi AVAILABLE)

### Table view (toggle):
| Tên phòng | Sức chứa | Trạng thái | Thiết bị | Hành động |
|-----------|----------|------------|----------|-----------|
| Meeting Room A | 10 | 🟢 Available | TV, Projector | [Xem] [Đặt] |

### Pagination:
- Hiển thị `Đang hiển thị 1-20 trên tổng 45 phòng`
- Nút Previous / Next + chọn số item/page (10, 20, 50)

---

## 5. Chi tiết phòng (`/rooms/:id`)

**Mục đích:** Xem thông tin đầy đủ của phòng + lịch đặt.

**API:**
- `GET /api/rooms/{room_id}` → thông tin phòng
- `GET /api/bookings/?room_id={room_id}&status=CONFIRMED` → lịch đặt phòng này

**Giao diện:**

### Phần trên: Thông tin phòng
```
┌──────────────────────────────────────────────────┐
│  [Ảnh phòng lớn]          │  Meeting Room A      │
│                           │  Sức chứa: 10 người  │
│                           │  Trạng thái: 🟢      │
│                           │  Quản lý: admin@...   │
│                           │                      │
│                           │  Thiết bị:           │
│                           │  ☑ TV/Màn hình       │
│                           │  ☑ Máy chiếu         │
│                           │  ☑ Camera            │
│                           │                      │
│                           │  [Đặt phòng này]     │
└──────────────────────────────────────────────────┘
```

### Phần dưới: Lịch đặt phòng (Calendar view)
- **Week view** mặc định: hiển thị các slot đã đặt theo ngày/giờ
- Mỗi slot booking hiển thị:
  - Thời gian (08:00–09:00)
  - Tên người đặt
  - Trạng thái (CONFIRMED / CHECKED_IN / CANCELLED)
- Slot trống → click để đặt nhanh
- Nút chuyển tuần: `< Tuần trước | Tuần này | Tuần sau >`

### Nút hành động:
- **"Đặt phòng này"** → mở form đặt phòng (prefill room_id)
- Nếu phòng MAINTENANCE: hiển thị banner cảnh báo "Phòng đang bảo trì, không thể đặt"

---

## 6. Form đặt phòng (`/rooms/:id/book` hoặc Modal)

**Mục đích:** Tạo booking mới.

**API:** `POST /api/bookings/`

**Request body:**
```json
{
  "room_id": 1,
  "start_at": "2026-10-29T09:00:00+07:00",
  "end_at": "2026-10-29T10:00:00+07:00",
  "num_attendees": 5,
  "attendees": [
    {"email": "alice@company.com", "name": "Alice Nguyen"},
    {"email": "bob@company.com", "name": "Bob Tran"}
  ]
}
```

**Giao diện:**

### Form fields:

| Field | Component | Validation | Ghi chú |
|-------|-----------|------------|---------|
| Phòng họp | Dropdown (disabled nếu prefill) | Bắt buộc | Hiển thị tên + sức chứa |
| Ngày | DatePicker | Không cho chọn quá khứ | Timezone Asia/Saigon |
| Giờ bắt đầu | TimePicker (bội số 30 phút) | >= hiện tại | 07:00 – 22:00 |
| Giờ kết thúc | TimePicker | > giờ bắt đầu | Tự động +1h khi chọn bắt đầu |
| Số người tham dự | NumberInput | > 0, ≤ capacity | Hiển thị cảnh báo nếu > capacity |
| Người tham dự | Dynamic list (email + tên) | Email hợp lệ | Nút "+ Thêm người", "✕ Xóa" |

### Xử lý lỗi từ API:
| HTTP Status | Hiển thị |
|-------------|----------|
| 201 Created | Toast thành công + redirect `/my-bookings` |
| 409 Conflict | "Phòng đã được đặt trong khung giờ này. Vui lòng chọn giờ khác." |
| 422 Validation | Highlight field lỗi + message cụ thể |
| 400 Past booking | "Không thể đặt phòng trong quá khứ" |

### Preview trước khi submit:
```
┌─────────────────────────────────────┐
│  Xác nhận đặt phòng                │
│                                     │
│  Phòng: Meeting Room A              │
│  Ngày: 29/10/2026                   │
│  Giờ: 09:00 – 10:00 (1 tiếng)      │
│  Số người: 5                        │
│  Người tham dự:                     │
│    - Alice Nguyen (alice@...)       │
│    - Bob Tran (bob@...)             │
│                                     │
│  [Hủy]              [Xác nhận đặt] │
└─────────────────────────────────────┘
```

---

## 7. Booking của tôi (`/my-bookings`)

**Mục đích:** Xem và quản lý tất cả booking của bản thân.

**API:** `GET /api/bookings/?limit=20&offset=0&status=`

**Giao diện:**

### Tab filter:
- **Tất cả** | **Sắp tới** (CONFIRMED, start_at > now) | **Đã check-in** (CHECKED_IN) | **Đã hủy** (CANCELLED)

### Bảng danh sách:

| # | Phòng | Ngày | Giờ | Số người | Trạng thái | Hành động |
|---|-------|------|-----|----------|------------|-----------|
| 1 | Meeting Room A | 29/10 | 09:00–10:00 | 5 | 🟢 Confirmed | [Check-in] [Hủy] |
| 2 | Meeting Room B | 28/10 | 14:00–15:00 | 3 | 🔵 Checked-in | — |
| 3 | Meeting Room A | 27/10 | 10:00–11:00 | 8 | 🔴 Cancelled | — |

### Hành động theo trạng thái:

| Trạng thái | Hành động có thể | Điều kiện |
|------------|-------------------|-----------|
| CONFIRMED | **Check-in**, **Hủy**, **Sửa** | Check-in: chỉ trong cửa sổ ±15 phút start_at |
| CHECKED_IN | (không có) | Booking đã sử dụng |
| CANCELLED | (không có) | Booking đã hủy |

### Check-in flow:
```
Nút [Check-in] → POST /api/bookings/{id}/check-in
  → Thành công: Toast "Check-in thành công!", cập nhật status
  → Lỗi 400: "Chưa đến giờ check-in" hoặc "Đã quá hạn check-in"
```

### Hủy booking flow:
```
Nút [Hủy] → Modal xác nhận "Bạn có chắc muốn hủy booking này?"
  → [Xác nhận hủy] → PATCH /api/bookings/{id} (status: CANCELLED)
  → Thành công: Toast "Đã hủy booking", cập nhật danh sách
```

### Chi tiết booking (expand row hoặc modal):
- Tên phòng, sức chứa, thiết bị
- Thời gian đặt (start – end)
- Danh sách người tham dự (email, tên)
- Thời gian tạo, thời gian check-in (nếu có)
- Thời gian auto-cancel (nếu có)

---

## 8. Quản lý phòng — Admin (`/admin/rooms`)

**Mục đích:** Room Manager / Admin quản lý (tạo, sửa, xóa) phòng họp.

**API:**
- `GET /api/rooms/` — danh sách
- `POST /api/rooms/` — tạo mới
- `PATCH /api/rooms/{id}` — cập nhật
- `DELETE /api/rooms/{id}` — xóa mềm

**Yêu cầu role:** `Room Manager` hoặc `Administrator`

### Giao diện chính: Bảng quản lý

```
┌─────────────────────────────────────────────────────────────┐
│  Quản lý phòng họp                        [+ Tạo phòng mới]│
│                                                             │
│  🔍 Tìm kiếm...    [Trạng thái ▾]                          │
│                                                             │
│  ┌───┬────────────┬────────┬──────────┬──────────┬────────┐ │
│  │ # │ Tên phòng  │Sức chứa│Trạng thái│ Thiết bị │Hành động│
│  ├───┼────────────┼────────┼──────────┼──────────┼────────┤ │
│  │ 1 │ Room A     │ 10     │ 🟢 Avail │ TV, Proj │ ✏️ 🗑️  │
│  │ 2 │ Room B     │ 20     │ 🟡 Maint │ Camera   │ ✏️ 🗑️  │
│  │ 3 │ Room C     │ 5      │ 🟢 Avail │ —        │ ✏️ 🗑️  │
│  └───┴────────────┴────────┴──────────┴──────────┴────────┘ │
│                                                             │
│  Hiển thị 1-20 trên 45 phòng          [< Trước] [Sau >]    │
└─────────────────────────────────────────────────────────────┘
```

### Form tạo/sửa phòng (Modal hoặc Drawer):

| Field | Component | Validation |
|-------|-----------|------------|
| Tên phòng | TextInput | Bắt buộc, 1-255 ký tự, unique |
| Sức chứa | NumberInput | Bắt buộc, > 0 |
| Trạng thái | Select: AVAILABLE / MAINTENANCE / ARCHIVED | Mặc định AVAILABLE |
| Thiết bị | Multi-select checkboxes | Tùy chọn |
| Người quản lý | TextInput (owner_id) | Tùy chọn |

**Danh sách thiết bị có sẵn** (checkbox group):
- TV/Màn hình
- Máy chiếu (Projector)
- Camera hội nghị
- Microphone
- Whiteboard
- Điều hòa riêng
- (+ Thêm thiết bị tùy chỉnh: TextInput + nút Thêm)

### Xử lý:
```
Tạo phòng:
  POST /api/rooms/ { name, capacity, status, equipment, owner_id }
  → 201: Toast "Tạo phòng thành công", refresh danh sách
  → 409: "Tên phòng đã tồn tại"

Sửa phòng:
  PATCH /api/rooms/{id} { name?, capacity?, status?, equipment?, owner_id? }
  → 200: Toast "Cập nhật thành công"
  → 404: "Phòng không tồn tại"
  → 409: "Tên phòng đã tồn tại"

Xóa phòng (soft delete):
  Modal xác nhận → DELETE /api/rooms/{id}
  → 204: Toast "Đã xóa phòng", xóa khỏi danh sách
  → 404: "Phòng không tồn tại"
```

---

## 9. Lịch sử & Báo cáo — Admin (`/admin/reports`)

**Mục đích:** Admin xem toàn bộ lịch sử đặt phòng và thống kê.

**API:**
- `GET /api/bookings/?limit=50&offset=0` (admin có thể xem tất cả)
- Room statistics tính từ data

**Yêu cầu role:** `Administrator`

### Tab 1: Lịch sử đặt phòng

**Filter nâng cao:**
- Khoảng thời gian: DateRangePicker (từ ngày – đến ngày)
- Phòng: Dropdown chọn phòng
- Trạng thái: Multi-select (CONFIRMED / CHECKED_IN / CANCELLED)
- Người đặt: TextInput tìm theo user_id/email

**Bảng kết quả:**

| # | Người đặt | Phòng | Ngày | Giờ | Số người | Trạng thái | Check-in lúc | Ghi chú |
|---|-----------|-------|------|-----|----------|------------|-------------|---------|
| 1 | hung@... | Room A | 29/10 | 09:00–10:00 | 5 | ✅ Checked-in | 08:52 | — |
| 2 | alice@... | Room B | 29/10 | 14:00–15:00 | 3 | 🔴 Cancelled | — | Auto-cancelled |
| 3 | bob@... | Room A | 28/10 | 10:00–11:00 | 8 | ✅ Checked-in | 09:58 | — |

- Sắp xếp theo cột (click header)
- Export CSV (tương lai)
- Pagination

### Tab 2: Thống kê (Dashboard báo cáo)

**Stat cards (trên cùng):**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Tổng booking │ │  Check-in    │ │  Tỷ lệ hủy   │ │  Phòng phổ   │
│  tháng này    │ │  đúng giờ    │ │              │ │  biến nhất   │
│    156        │ │    89%       │ │    12%       │ │  Room A      │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

**Biểu đồ:**
- **Bar chart:** Số booking theo ngày (7 ngày gần nhất)
- **Pie chart:** Phân bố trạng thái booking (Confirmed / Checked-in / Cancelled)
- **Bar chart:** Top 5 phòng được đặt nhiều nhất
- **Line chart:** Xu hướng sử dụng phòng theo tuần

**Lọc thời gian:** 7 ngày / 30 ngày / Quý này / Tùy chỉnh

---

## 10. Responsive & Mobile

### Breakpoints:
- **Desktop:** ≥ 1024px — sidebar + content
- **Tablet:** 768px – 1023px — sidebar collapsed (icon-only), content full width
- **Mobile:** < 768px — sidebar hidden (hamburger menu), card layout thay table

### Mobile-specific:
- Room cards: 1 column full width
- Booking table → card list
- Form: stack vertical
- Calendar: day view thay week view
- Bottom navigation bar thay sidebar

---

## 11. Luồng người dùng chính (User Flows)

### Flow 1: Employee đặt phòng
```
Login → Dashboard → "Phòng trống ngay" hoặc sidebar "Danh sách phòng"
  → Chọn phòng → Xem chi tiết + lịch
  → Click "Đặt phòng" → Điền form → Xác nhận
  → Redirect "Booking của tôi" → Thấy booking mới (CONFIRMED)
```

### Flow 2: Employee check-in
```
Dashboard → "Booking sắp tới" → Nút [Check-in] (active khi ±15 phút start_at)
  → POST /api/bookings/{id}/check-in
  → Status đổi CONFIRMED → CHECKED_IN
```

### Flow 3: Admin tạo phòng mới
```
Sidebar "Quản lý phòng" → Nút [+ Tạo phòng mới]
  → Điền: tên, sức chứa, thiết bị (checkboxes), trạng thái
  → POST /api/rooms/ → Toast thành công → Phòng xuất hiện trong danh sách
```

### Flow 4: Admin xem báo cáo
```
Sidebar "Lịch sử & Báo cáo"
  → Tab "Thống kê" → Xem stat cards + biểu đồ
  → Tab "Lịch sử" → Filter theo phòng/ngày/trạng thái → Xem bảng chi tiết
```

### Flow 5: Auto-cancel notification
```
Booking CONFIRMED + không check-in sau 15 phút start_at
  → auto_cancel worker: status → CANCELLED, set auto_cancelled_at
  → notification-worker gửi email thông báo
  → Employee mở "Booking của tôi" → Thấy booking đã CANCELLED (auto)
```

---

## 12. Bảng tổng hợp API ↔ UI

| Trang | Method | Endpoint | Mô tả |
|-------|--------|----------|-------|
| Danh sách phòng | GET | `/api/rooms/?status=&q=&limit=&offset=` | Lấy danh sách phòng có filter |
| Chi tiết phòng | GET | `/api/rooms/{id}` | Thông tin 1 phòng |
| Đặt phòng | POST | `/api/bookings/` | Tạo booking mới |
| Booking của tôi | GET | `/api/bookings/?limit=&offset=&status=` | Danh sách booking của user |
| Chi tiết booking | GET | `/api/bookings/{id}` | Thông tin 1 booking |
| Sửa booking | PATCH | `/api/bookings/{id}` | Cập nhật booking |
| Hủy booking | PATCH | `/api/bookings/{id}` | Cancel booking |
| Check-in | POST | `/api/bookings/{id}/check-in` | Check-in booking |
| Tạo phòng | POST | `/api/rooms/` | Admin tạo phòng mới |
| Sửa phòng | PATCH | `/api/rooms/{id}` | Admin cập nhật phòng |
| Xóa phòng | DELETE | `/api/rooms/{id}` | Admin soft-delete phòng |
| Sync rooms | POST | `/api/bookings/admin/sync-rooms` | Đồng bộ room snapshots |
| Health check | GET | `/api/bookings/health` | Kiểm tra trạng thái service |
| Health check | GET | `/api/rooms/health` | Kiểm tra trạng thái service |

---

## 13. Trạng thái & Màu sắc

### Room Status:
| Status | Badge | Màu | Ý nghĩa |
|--------|-------|-----|---------|
| AVAILABLE | 🟢 Đang hoạt động | `#52c41a` (green) | Có thể đặt |
| MAINTENANCE | 🟡 Đang bảo trì | `#faad14` (gold) | Không thể đặt |
| ARCHIVED | ⚫ Lưu trữ | `#8c8c8c` (gray) | Không hiển thị cho Employee |

### Booking Status:
| Status | Badge | Màu | Ý nghĩa |
|--------|-------|-----|---------|
| CONFIRMED | 🔵 Đã xác nhận | `#1890ff` (blue) | Chờ check-in |
| CHECKED_IN | 🟢 Đã check-in | `#52c41a` (green) | Đang sử dụng |
| CANCELLED | 🔴 Đã hủy | `#ff4d4f` (red) | Bị hủy (thủ công hoặc auto) |

---

## 14. Xử lý lỗi chung

| HTTP Status | Hiển thị | Hành động |
|-------------|----------|-----------|
| 401 Unauthorized | "Phiên đăng nhập hết hạn" | Redirect `/login` |
| 403 Forbidden | "Bạn không có quyền thực hiện thao tác này" | Disable nút, ẩn menu |
| 404 Not Found | "Không tìm thấy tài nguyên" | Nút "Quay lại" |
| 409 Conflict | Message cụ thể từ API | Highlight field lỗi |
| 422 Validation | Highlight field + message | Inline error dưới field |
| 429 Rate Limited | "Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau." | Auto retry sau 3s |
| 500 Server Error | "Đã xảy ra lỗi. Vui lòng thử lại." | Nút "Thử lại" |

---

## 15. Cấu trúc thư mục Frontend

```
frontend/
├── public/
│   └── favicon.ico
├── src/
│   ├── api/                    # API client (axios/fetch wrapper)
│   │   ├── client.ts           # Base HTTP client + interceptors
│   │   ├── rooms.ts            # Room API functions
│   │   └── bookings.ts         # Booking API functions
│   ├── auth/                   # Auth0 integration
│   │   ├── AuthProvider.tsx    # Auth0Provider wrapper
│   │   ├── useAuth.ts          # Hook: login, logout, token
│   │   └── ProtectedRoute.tsx  # Route guard theo role
│   ├── components/             # Shared/reusable components
│   │   ├── Layout/
│   │   │   ├── AppLayout.tsx   # Sidebar + Header + Content
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── RoomCard.tsx
│   │   ├── BookingTable.tsx
│   │   ├── StatusBadge.tsx
│   │   └── ConfirmModal.tsx
│   ├── pages/                  # Route-level components
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── RoomList.tsx
│   │   ├── RoomDetail.tsx
│   │   ├── BookingForm.tsx
│   │   ├── MyBookings.tsx
│   │   ├── admin/
│   │   │   ├── RoomManagement.tsx
│   │   │   └── Reports.tsx
│   │   └── NotFound.tsx
│   ├── hooks/                  # Custom hooks
│   │   ├── useRooms.ts
│   │   ├── useBookings.ts
│   │   └── usePagination.ts
│   ├── types/                  # TypeScript interfaces
│   │   ├── room.ts
│   │   ├── booking.ts
│   │   └── auth.ts
│   ├── utils/
│   │   ├── date.ts             # Format datetime Asia/Saigon
│   │   └── constants.ts
│   ├── App.tsx                 # Router setup
│   └── main.tsx                # Entry point
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── Dockerfile
```
