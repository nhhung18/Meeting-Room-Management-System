# Prompt cho Google AI Studio — Thiết kế UI

> Copy toàn bộ nội dung bên dưới dòng này vào Google AI Studio.

---

Design a complete, modern web UI for a **Meeting Room Management System (MRMS)** — an internal corporate app where employees book meeting rooms, check in, and admins manage rooms and view reports.

## Tech & Style Requirements

- **Framework:** React 18 + TypeScript + Vite
- **UI Library:** Ant Design 5 (antd)
- **Routing:** React Router v6
- **Style:** Clean, professional, minimal — corporate SaaS look. White/light gray background, blue primary accent (`#1890ff`). No heavy gradients. Consistent 8px spacing grid.
- **Responsive:** Desktop-first (1280px), must work at tablet (768px) and mobile (375px).
- **Language:** Vietnamese for all labels and UI text. Code identifiers in English.
- **Dark mode:** Not required.
- **Icons:** Ant Design icons (`@ant-design/icons`).

## System Context

**3 user roles:**
- **Employee** — book rooms, view own bookings, check-in
- **Room Manager** — all Employee features + create/edit/delete rooms
- **Administrator** — full access + reports & statistics

**Authentication:** Auth0 (JWT). Dev mode = auto-login as anonymous admin.

**Backend APIs (already built):**

```
Room Service (GET/POST/PATCH/DELETE /api/rooms/):
  Room: { id, name, capacity, status, equipment: string[], owner_id, created_at, updated_at }
  RoomStatus: "AVAILABLE" | "MAINTENANCE" | "ARCHIVED"
  Filters: ?status=&q=&limit=&offset=

Booking Service (GET/POST/PATCH /api/bookings/):
  Booking: { id, room_id, user_id, start_at, end_at, num_attendees, status,
             checked_in_at, auto_cancelled_at, created_at, updated_at,
             room_name, attendees: [{id, attendee_email, name}] }
  BookingStatus: "CONFIRMED" | "CHECKED_IN" | "CANCELLED"
  Check-in: POST /api/bookings/{id}/check-in (window: ±15 min of start_at)
  Filters: ?status=&limit=&offset=
```

## Pages to Design (generate full React + Ant Design code for each)

### 1. Login Page (`/login`)
- Centered card with MRMS logo, app title "Hệ thống quản lý phòng họp"
- Single button "Đăng nhập với Auth0" → triggers Auth0 redirect
- Clean, minimal, no sidebar

### 2. App Layout (shared wrapper)
- **Left sidebar** (antd `Layout.Sider`, collapsible):
  - Menu items with icons, highlighted on active route
  - Employee sees: Dashboard, Danh sách phòng, Booking của tôi
  - Room Manager adds: Quản lý phòng
  - Admin adds: Lịch sử & Báo cáo
- **Header** (antd `Layout.Header`):
  - Left: breadcrumb or page title
  - Right: user avatar + name + dropdown (Thông tin, Đăng xuất)
- **Content area** with 24px padding, max-width 1400px centered

### 3. Dashboard (`/dashboard`)
- **Top row — 4 stat cards** (antd `Statistic` inside `Card`):
  - Phòng hoạt động (count of AVAILABLE rooms)
  - Booking hôm nay (today's bookings count)
  - Đã check-in (today's CHECKED_IN count)
  - Tỷ lệ sử dụng (percentage)
- **Left column — "Booking sắp tới"** (antd `List` or `Timeline`):
  - Next 5 CONFIRMED bookings of current user
  - Each item: room name, time range, num attendees
  - **Check-in button** shown only when within ±15 min of start_at (antd `Button` type="primary" size="small")
  - Click item → navigate to booking detail
- **Right column — "Phòng trống ngay"** (antd `Card` grid, 2 columns):
  - Rooms currently AVAILABLE with no active booking
  - Each card: room name, capacity badge, equipment tags
  - "Đặt ngay" button → navigate to booking form with room prefilled

### 4. Room List (`/rooms`)
- **Filter bar** (antd `Space` + `Input.Search` + `Select` + `Tag` checkboxes):
  - Search by name (`q` param)
  - Status dropdown: Tất cả / Đang hoạt động / Bảo trì
  - Capacity filter: ≥5 / ≥10 / ≥20
  - Equipment filter: multi-select tags (TV, Máy chiếu, Camera, Microphone, Whiteboard)
- **Toggle:** Card view (default) / Table view
- **Card view** (antd `Card` in `Row`/`Col` grid, 3 columns desktop, 2 tablet, 1 mobile):
  - Placeholder image area (light gray with room icon, 16:9 ratio)
  - Room name (bold), capacity with icon, status badge (antd `Tag` colored), equipment as small `Tag` list
  - Footer: "Xem chi tiết" link + "Đặt ngay" primary button (disabled if MAINTENANCE)
- **Table view** (antd `Table`):
  - Columns: Tên phòng, Sức chứa, Trạng thái (Tag), Thiết bị (Tags), Hành động (buttons)
  - Sortable columns
- **Pagination** (antd `Pagination`) bottom-right

### 5. Room Detail (`/rooms/:id`)
- **Top section** (two columns):
  - Left: large placeholder image (aspect 16:9, light gray bg)
  - Right: room info card
    - Name as `Title` level 3
    - Status: colored `Tag`
    - Capacity: `{capacity} người` with icon
    - Owner: owner_id or "Chưa phân công"
    - Equipment: list of `Tag` items
    - "Đặt phòng này" primary button (full width, disabled if not AVAILABLE)
- **Bottom section — Weekly calendar** (antd `Calendar` or custom grid):
  - 7-day view showing booking slots
  - Each booking slot: colored block with time + booker name
  - CONFIRMED = blue, CHECKED_IN = green, CANCELLED = red (strikethrough)
  - Empty slots clickable → open booking form with time prefilled
  - Navigation: "< Tuần trước" | "Tuần này" | "Tuần sau >"

### 6. Booking Form (`/rooms/:id/book` or modal)
- antd `Form` layout="vertical" inside a `Card`:
  - **Phòng họp**: `Select` dropdown (disabled + prefilled if navigated from room detail). Shows "Room Name (capacity người)"
  - **Ngày**: `DatePicker` — disallow past dates, Vietnamese locale
  - **Giờ bắt đầu**: `TimePicker` — format HH:mm, minute step 30, range 07:00–22:00
  - **Giờ kết thúc**: `TimePicker` — auto-set to start + 1h, must be > start
  - **Số người tham dự**: `InputNumber` min=1 max=room.capacity. Show warning `Alert` if exceeds capacity.
  - **Người tham dự** (dynamic list with `Form.List`):
    - Each row: `Input` for email + `Input` for name + remove button (MinusCircleOutlined)
    - "Thêm người tham dự" button (PlusOutlined) at bottom
  - **Summary section** before submit: gray `Descriptions` card showing all values
  - **Buttons:** "Hủy" (ghost) + "Xác nhận đặt phòng" (primary)
- **Error handling:**
  - 409 → `message.error("Phòng đã được đặt trong khung giờ này")`
  - 422 → inline field errors
  - Success → `message.success("Đặt phòng thành công!")` + redirect to /my-bookings

### 7. My Bookings (`/my-bookings`)
- **Tab filter** (antd `Tabs`): Tất cả | Sắp tới | Đã check-in | Đã hủy
- **Table** (antd `Table`, expandable rows):
  - Columns: #, Phòng, Ngày, Giờ, Số người, Trạng thái (`Tag`), Hành động
  - Status tags: CONFIRMED=blue, CHECKED_IN=green, CANCELLED=red
  - **Action buttons per status:**
    - CONFIRMED: "Check-in" primary button (enabled only within ±15min of start_at) + "Hủy" danger button
    - CHECKED_IN: no actions (show "Đã hoàn tất" text)
    - CANCELLED: no actions
  - **Expanded row:** booking detail — attendee list, created_at, checked_in_at, auto_cancelled_at
- **Cancel flow:** click "Hủy" → antd `Modal.confirm` "Bạn có chắc muốn hủy booking này?" → API call → refresh
- **Check-in flow:** click "Check-in" → API call → success toast → status updates in table
- **Empty state:** antd `Empty` with "Bạn chưa có booking nào" + "Đặt phòng ngay" link
- **Pagination** bottom-right

### 8. Room Management — Admin (`/admin/rooms`)
- **Header row:** page title "Quản lý phòng họp" + "Tạo phòng mới" primary button (PlusOutlined)
- **Filter bar:** Search input + Status dropdown
- **Table** (antd `Table`):
  - Columns: #, Tên phòng, Sức chứa, Trạng thái (Tag), Thiết bị (Tags), Cập nhật lúc, Hành động
  - Action column: Edit icon button (EditOutlined) + Delete icon button (DeleteOutlined, danger)
- **Create/Edit form** (antd `Drawer` sliding from right):
  - Title: "Tạo phòng mới" or "Chỉnh sửa phòng"
  - Fields:
    - Tên phòng: `Input` (required)
    - Sức chứa: `InputNumber` min=1 (required)
    - Trạng thái: `Select` — AVAILABLE/MAINTENANCE/ARCHIVED (default AVAILABLE)
    - Thiết bị: `Checkbox.Group` with predefined options (TV/Màn hình, Máy chiếu, Camera, Microphone, Whiteboard) + custom input to add new equipment
    - Người quản lý: `Input` (optional)
  - Footer: "Hủy" + "Lưu" primary button
- **Delete flow:** antd `Modal.confirm` with danger type → "Xác nhận xóa phòng {name}?" → API DELETE → refresh

### 9. Reports — Admin (`/admin/reports`)
- **Two tabs** (antd `Tabs`):

**Tab "Lịch sử đặt phòng":**
- Advanced filter row: DateRangePicker + Room Select + Status multi-select + User search input + "Lọc" button
- antd `Table` with all bookings (admin sees all users):
  - Columns: #, Người đặt, Phòng, Ngày, Giờ, Số người, Trạng thái, Check-in lúc
  - Sortable, pagination

**Tab "Thống kê":**
- **Time filter:** antd `Radio.Group` — 7 ngày / 30 ngày / Quý này
- **Stat cards row** (4 cards): Tổng booking, Check-in đúng giờ (%), Tỷ lệ hủy (%), Phòng phổ biến nhất
- **Charts** (use @ant-design/charts or recharts):
  - Bar chart: Số booking theo ngày (7 ngày gần nhất)
  - Pie chart: Phân bố trạng thái (CONFIRMED/CHECKED_IN/CANCELLED)
  - Horizontal bar: Top 5 phòng được đặt nhiều nhất
- Charts in a 2-column grid (antd `Row`/`Col` span=12)

## Color System

```css
:root {
  --primary: #1890ff;        /* Blue — primary actions, links */
  --success: #52c41a;        /* Green — AVAILABLE, CHECKED_IN */
  --warning: #faad14;        /* Gold — MAINTENANCE */
  --danger: #ff4d4f;         /* Red — CANCELLED, delete actions */
  --neutral: #8c8c8c;        /* Gray — ARCHIVED, disabled */
  --bg-page: #f5f5f5;        /* Page background */
  --bg-card: #ffffff;        /* Card background */
  --text-primary: #262626;   /* Main text */
  --text-secondary: #8c8c8c; /* Secondary text */
}
```

## Status Badge Mapping

```tsx
const roomStatusConfig = {
  AVAILABLE:   { color: "success", label: "Đang hoạt động" },
  MAINTENANCE: { color: "warning", label: "Đang bảo trì" },
  ARCHIVED:    { color: "default", label: "Lưu trữ" },
};

const bookingStatusConfig = {
  CONFIRMED:  { color: "processing", label: "Đã xác nhận" },
  CHECKED_IN: { color: "success",    label: "Đã check-in" },
  CANCELLED:  { color: "error",      label: "Đã hủy" },
};
```

## TypeScript Interfaces

```typescript
interface Room {
  id: number;
  name: string;
  capacity: number;
  status: "AVAILABLE" | "MAINTENANCE" | "ARCHIVED";
  equipment: string[];
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Booking {
  id: number;
  room_id: number;
  user_id: string;
  start_at: string;    // ISO 8601 with timezone
  end_at: string;
  num_attendees: number;
  status: "CONFIRMED" | "CHECKED_IN" | "CANCELLED";
  checked_in_at: string | null;
  auto_cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  room_name: string | null;
  attendees: Attendee[];
}

interface Attendee {
  id: number;
  attendee_email: string;
  name: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
```

## Output Requirements

For each page, generate:
1. **Complete React component** (.tsx) with Ant Design components
2. **Proper TypeScript typing** — no `any`
3. **Responsive** — use antd `Row`/`Col` with responsive breakpoints
4. **Vietnamese text** for all labels, placeholders, messages
5. **Mock data** inline so the page renders without a backend
6. **API call functions** in separate files (use `fetch` or `axios`, base URL `/api`)
7. **React Router** routes in App.tsx with role-based `ProtectedRoute` wrapper

Generate all pages in order: Login → Layout → Dashboard → RoomList → RoomDetail → BookingForm → MyBookings → RoomManagement → Reports. Include the complete App.tsx with routing and the shared Layout component.
