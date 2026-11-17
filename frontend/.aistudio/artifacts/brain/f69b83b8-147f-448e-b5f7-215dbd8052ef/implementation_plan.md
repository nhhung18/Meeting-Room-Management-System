# Kế hoạch mở rộng chức năng Quản trị hệ thống (Admin Capabilities & System Governance)

Kế hoạch này tích hợp toàn diện 4 phân hệ cốt lõi dành riêng cho vai trò Quản trị viên cấp cao (**Administrator**), nâng cấp hệ thống đặt phòng họp từ cấp độ phòng ban lên chuẩn vận hành doanh nghiệp (Enterprise-ready):
1. **Quản lý người dùng & Phân quyền vai trò (User Management & RBAC)**
2. **Quản lý toàn bộ phòng họp & Thẩm quyền ghi đè (Global Room Governance & Admin Override)**
3. **Báo cáo phân tích & Trang Nhật ký hoạt động chuyên sâu (Reports & Dedicated Audit Log)**
4. **Cấu hình các quy định đặt phòng linh hoạt (Booking Policy & Auto-Release Rules Engine)**

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Các quyết định cốt lõi đã được xác nhận thông qua trao đổi và khảo sát nhu cầu:

- **Confirmed Decision 1 (Quản lý người dùng)**: Sử dụng bảng danh sách mật độ cao trực quan, cho phép Quản trị viên thay đổi vai trò trực tiếp (`ADMINISTRATOR`, `ROOM_MANAGER`, `EMPLOYEE`) và thao tác khóa / mở khóa tài khoản người dùng ngay trên từng dòng dữ liệu, có hộp thoại xác nhận bảo vệ an toàn (chống tự tước quyền của chính mình).
- **Confirmed Decision 2 (Cấu hình quy định đặt phòng)**: Cung cấp trang cấu hình tập trung cho phép thiết lập: số ngày đặt trước tối đa, thời lượng cuộc họp tối đa một lần đặt, và thời gian ân hạn tự động hủy phòng nếu người chủ trì không thực hiện Check-in sau giờ bắt đầu.
- **Confirmed Decision 3 (Báo cáo & Audit Log)**: Tách riêng phân hệ **Nhật ký hoạt động (Audit Log)** thành một trang độc lập (`/admin/audit-logs`) với bộ lọc đa chiều (theo người thao tác, loại hành động, thời gian), giữ trang **Báo cáo** (`/admin/reports`) chuyên biệt cho các chỉ số trực quan về công suất sử dụng phòng và phân tích xu hướng.
- **Confirmed Decision 4 (Quản lý toàn bộ phòng họp)**: Admin sở hữu thẩm quyền cao nhất để ghi đè lịch phòng: Cưỡng chế kết thúc/giải phóng phòng họp đang bị giữ ảo ("Force Release"), chuyển trạng thái Bảo trì / Sẵn sàng tức thì, và kiểm tra lịch họp của mọi phòng không phân biệt người tổ chức.

---

### 1. Overview & Core Concept

- **What It Does**: Cung cấp bộ công cụ quản trị tập trung toàn diện cho `ADMINISTRATOR`, kiểm soát từ con người (người dùng, quyền hạn), tài sản vật lý (phòng họp, thiết bị, trạng thái bảo trì), quy tắc nghiệp vụ (chính sách thời gian đặt, kiểm soát no-show), cho đến tính minh bạch kiểm toán (truy vết mọi thay đổi trong hệ thống qua Audit Log).
- **Target Audience / Persona**: 
  - *System Administrator*: Kiểm soát tài khoản, cấp phát vai trò Quản lý phòng/Nhân viên, cấu hình thông số vận hành toàn công ty.
  - *Facility / Operations Manager*: Theo dõi công suất phòng, rà soát lịch sử sử dụng, can thiệp xử lý các trường hợp xung đột phòng hoặc phòng bị chiếm dụng vô căn cứ.
- **Key Value**: 
  - Loại bỏ hoàn toàn tình trạng "chiếm phòng ảo" (Ghost bookings) thông qua quy tắc tự hủy khi trễ Check-in.
  - Đảm bảo tính tuân thủ và minh bạch dữ liệu (Auditability) đạt chuẩn bảo mật doanh nghiệp.
  - Trao quyền kiểm soát nhanh chóng, hạn chế các thao tác thủ công rườm rà.

---

### 2. User Experience & Visual Design

Thiết kế tuân thủ nghiêm ngặt chuẩn mực **SaaS & Enterprise Dashboard** từ hiến pháp giao diện (anti-slop, zero-pill metadata, single-elevation depth, monospace tabular numbers, và dual-theme light/dark):

#### A. Phân hệ 1: Quản lý người dùng & Phân quyền (`/admin/users`)
- **Vị trí & Điều hướng**: Menu Sidebar mục "Quản trị" -> "Người dùng & Phân quyền" (chỉ hiển thị cho role `ADMINISTRATOR`).
- **Giao diện bảng dữ liệu (Data Grid)**:
  - Header: Thanh tìm kiếm theo tên/email, bộ lọc vai trò (`Tất cả`, `Admin`, `Quản lý`, `Nhân viên`), bộ lọc phòng ban.
  - Cột 1: Thông tin cá nhân (Avatar bo tròn tinh tế, Tên hiển thị đậm, email dạng chữ mờ dưới tên).
  - Cột 2: Phòng ban & Chức danh (Văn bản typography rõ ràng, không đóng khung pill).
  - Cột 3: Trạng thái tài khoản (Nhãn văn bản kèm biểu tượng: `Hoạt động` với màu xanh lá `#16A34A` hoặc `Đã khóa` với màu xám trung tính `#64748B`).
  - Cột 4: Vai trò hệ thống: Dropdown `Select` có thể đổi trực tiếp (`ADMINISTRATOR` / `ROOM_MANAGER` / `EMPLOYEE`). Khi đổi vai trò của người dùng khác, hiển thị toast thông báo thành công và ghi log vào hệ thống.
  - Cột 5: Hành động nhanh: Nút "Khóa tài khoản" / "Mở khóa" kèm Popconfirm xác nhận. Vô hiệu hóa nút khóa đối với tài khoản đang đăng nhập hiện tại để tránh lock-out.

#### B. Phân hệ 2: Quản lý toàn bộ phòng họp (`/admin/rooms`)
- **Nâng cấp thẩm quyền Admin**:
  - Tại bảng danh sách phòng, bổ sung nút thao tác đặc quyền: **Cưỡng chế giải phóng phòng (Force Release)** khi phòng đang có cuộc họp diễn ra nhưng không có người sử dụng.
  - Chuyển đổi trạng thái phòng giữa `AVAILABLE` và `MAINTENANCE` tức thì kèm lý do bảo trì.
  - Nút xem toàn bộ lịch đặt phòng của phòng đó (All bookings view) với quyền hủy lịch bất kỳ kèm lý do gửi thông báo cho người tổ chức.

#### C. Phân hệ 3: Nhật ký hoạt động chuyên sâu (`/admin/audit-logs`)
- **Giao diện dòng thời gian & Bảng kiểm toán**:
  - Thanh công cụ lọc:
    - Lọc theo Người thực hiện (Actor: chọn người dùng hoặc tìm kiếm).
    - Lọc theo Nhóm hành động (Booking, Room, User Role, Policy Change, Check-in).
    - Bộ lọc khoảng ngày (Date Range Picker).
  - Bảng Audit Log chuẩn Enterprise:
    - Cột 1 - Thời gian: Hiển thị định dạng `YYYY-MM-DD HH:mm:ss` sử dụng font `font-mono tabular-nums`.
    - Cột 2 - Người thao tác: Tên + Role tại thời điểm thực hiện.
    - Cột 3 - Hành động (Action Type): Mã hành động rõ ràng (ví dụ: `ROLE_UPDATED`, `ROOM_MAINTENANCE_TOGGLED`, `BOOKING_FORCE_CANCELLED`, `POLICY_UPDATED`).
    - Cột 4 - Đối tượng tác động (Target): Tên phòng, tên người dùng hoặc mã đặt phòng bị tác động.
    - Cột 5 - Chi tiết thay đổi (Details / Delta): Hiển thị tóm tắt trực quan (ví dụ: `Vai trò đổi từ EMPLOYEE sang ROOM_MANAGER` hoặc `Hủy lịch do vi phạm quy định check-in`).
  - Nút "Xuất dữ liệu CSV" để tải báo cáo log phục vụ công tác thanh tra.

#### D. Phân hệ 4: Cấu hình quy định đặt phòng (`/admin/settings`)
- **Bố cục thẻ cấu hình chính sách (Policy Configuration Canvas)**:
  - Phân vùng 1 - Quy định thời gian đặt phòng:
    - *Số ngày cho phép đặt trước tối đa*: Input số (1 - 90 ngày, mặc định: 14 ngày).
    - *Thời lượng cuộc họp tối đa một lần*: Input số (15 - 480 phút, mặc định: 180 phút - tương đương 3 giờ).
    - *Thời lượng cuộc họp tối thiểu*: Input số (15 - 60 phút, mặc định: 15 phút).
  - Phân vùng 2 - Cơ chế tự động giải phóng phòng (No-Show Protection):
    - *Bật/Tắt tự động hủy nếu không check-in*: Công tắc Switch.
    - *Thời gian ân hạn trước khi tự động hủy*: Input số (5 - 30 phút sau khi cuộc họp bắt đầu, mặc định: 15 phút).
    - *Thời gian đệm dọn dẹp giữa các cuộc họp*: Input số (0 - 30 phút, mặc định: 0 phút).
  - Phân vùng 3 - Quy định hủy lịch:
    - *Thời gian tối thiểu được phép hủy trước giờ họp*: Input số (0 - 120 phút, mặc định: 30 phút).
  - Chân trang cấu hình: Nút "Khôi phục mặc định" và nút "Lưu thay đổi chính sách" (Primary Button). Khi lưu, cập nhật ngay lập tức vào state hệ thống và ghi nhận sự kiện vào Audit Log.

---

### 3. Key Product Decisions & Trade-Offs

- **Quyết định 1: Đổi quyền trực tiếp trên dòng (Inline Role Assignment) vs. Modal chi tiết**:
  - *Lựa chọn*: Đổi trực tiếp qua dropdown với popconfirm bảo vệ an toàn.
  - *Lý do*: Tiết kiệm đến 80% số lượt click chuột cho Quản trị viên khi điều chỉnh quyền nhiều nhân sự cùng lúc. Ngăn chặn triệt để rủi ro tự tước quyền bằng cách disable tùy chọn của chính admin đang đăng nhập.
- **Quyết định 2: Tách biệt trang Nhật ký hoạt động (`/admin/audit-logs`) và Báo cáo (`/admin/reports`)**:
  - *Lựa chọn*: Tách thành 2 trang riêng biệt trong nhóm menu Quản trị.
  - *Lý do*: Báo cáo phục vụ xem xét dữ liệu tổng hợp (KPI, tỷ lệ sử dụng, số giờ họp); Audit log phục vụ an toàn thông tin, rà soát lỗi và kiểm tra trách nhiệm cá nhân với yêu cầu mật độ dữ liệu cao và tính năng tìm kiếm, trích xuất log.
- **Quyết định 3: Ràng buộc chính sách thời gian (Policy Enforcement) ngay trên Frontend & API Client**:
  - *Lựa chọn*: Áp dụng quy tắc từ bảng cấu hình vào `BookingFormPage` và hàm kiểm tra `createBooking` / `updateBooking` của `client.ts`.
  - *Lý do*: Ngay khi người dùng chọn ngày họp quá xa hoặc thời lượng vượt quá hạn mức công ty, giao diện lập tức hiển thị cảnh báo hướng dẫn mà không cần chờ gửi yêu cầu lên server.

---

### 4. Technical Architecture & Data Strategy

#### Sơ đồ Kiến trúc & Luồng Dữ liệu (System Architecture Diagram)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ADMIN GOVERNANCE SUITE                                │
└───────────────┬─────────────────┬───────────────────┬───────────────────┬───────┘
                │                 │                   │                   │
                ▼                 ▼                   ▼                   ▼
     ┌──────────────────┐ ┌───────────────┐ ┌───────────────────┐ ┌───────────────┐
     │  UserManagement  │ │GlobalRoomAdmin│ │  AuditLogViewer   │ │PolicySettings │
     │  (/admin/users)  │ │(/admin/rooms) │ │(/admin/audit-logs)│ │(/admin/settin.)│
     └─────────┬────────┘ └───────┬───────┘ └─────────┬─────────┘ └───────┬───────┘
               │                  │                   │                   │
               ▼                  ▼                   ▼                   ▼
     ┌────────────────────────────────────────────────────────────────────────────┐
     │                    API CLIENT & STORAGE LAYER (client.ts)                  │
     │  - getUsers(), updateUserRole(), toggleUserStatus()                        │
     │  - forceReleaseRoom(), toggleRoomMaintenance()                             │
     │  - getAuditLogs(), logAuditEvent()                                         │
     │  - getSystemPolicies(), updateSystemPolicies()                             │
     └─────────────────────────────────────┬──────────────────────────────────────┘
                                           │
                                           ▼
     ┌────────────────────────────────────────────────────────────────────────────┐
     │            LOCALSTORAGE PERSISTENCE & INITIAL MOCK DATA                    │
     │  - USERS_STORAGE_KEY: danh sách nhân viên, avatar, phòng ban, role, status │
     │  - AUDIT_LOGS_STORAGE_KEY: lịch sử thao tác hệ thống (thời gian, actor...) │
     │  - POLICIES_STORAGE_KEY: quy định đặt phòng, giới hạn giờ, grace period    │
     └────────────────────────────────────────────────────────────────────────────┘
```

#### Mô hình dữ liệu mở rộng (`src/types/index.ts`)

```ts
// 1. Quản lý Người dùng & Phân quyền
export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: 'ADMINISTRATOR' | 'ROOM_MANAGER' | 'EMPLOYEE';
  department: string;
  phone?: string;
  avatar_url?: string;
  status: 'ACTIVE' | 'SUSPENDED';
  created_at: string;
}

// 2. Nhật ký kiểm toán hoạt động
export type AuditActionType = 
  | 'USER_ROLE_CHANGED'
  | 'USER_STATUS_TOGGLED'
  | 'ROOM_CREATED'
  | 'ROOM_UPDATED'
  | 'ROOM_MAINTENANCE_TOGGLED'
  | 'ROOM_FORCE_RELEASED'
  | 'BOOKING_FORCE_CANCELLED'
  | 'POLICY_CONFIG_UPDATED'
  | 'EQUIPMENT_ALLOCATED';

export interface AuditLogEntry {
  id: string;
  timestamp: string;          // ISO String
  actor_id: string;           // Người thực hiện
  actor_name: string;
  actor_role: 'ADMINISTRATOR' | 'ROOM_MANAGER' | 'EMPLOYEE';
  action_type: AuditActionType;
  target_id?: string | number;
  target_name?: string;
  details: string;            // Mô tả chi tiết hành động
  ip_address?: string;
}

// 3. Quy định đặt phòng toàn hệ thống
export interface BookingPolicyConfig {
  max_advance_days: number;           // Mặc định: 14 ngày
  max_duration_minutes: number;       // Mặc định: 180 phút
  min_duration_minutes: number;       // Mặc định: 15 phút
  enable_auto_release_no_show: boolean; // Mặc định: true
  auto_release_grace_minutes: number;  // Mặc định: 15 phút
  buffer_minutes_between_meetings: number; // Mặc định: 0 phút
  min_cancel_notice_minutes: number;  // Mặc định: 30 phút
  updated_at: string;
  updated_by_name: string;
}
```

#### Ánh xạ Tương tác & Trạng thái (Interactive Handlers & State Mapping)
1. **UserManagementPage**:
   - `handleRoleChange(userId, newRole)`: Gọi `updateUserRole`, tự động ghi audit log `USER_ROLE_CHANGED`, hiển thị thông báo Ant Design `message.success`.
   - `handleStatusToggle(userId, currentStatus)`: Gọi `toggleUserStatus`, hiển thị cảnh báo nếu khóa tài khoản, cập nhật trạng thái `ACTIVE` / `SUSPENDED`.
2. **Global Room Override**:
   - `handleForceRelease(roomId)`: Tìm booking đang diễn ra trong phòng, chuyển trạng thái sang `CANCELLED` với ghi chú `"Hủy cưỡng chế bởi Quản trị viên"`, ghi audit log `ROOM_FORCE_RELEASED`, giải phóng phòng sang `AVAILABLE`.
3. **AuditLogPage**:
   - `fetchLogs(filters)`: Tải log theo bộ lọc từ LocalStorage, hỗ trợ phân trang và tìm kiếm theo từ khóa.
   - `handleExportCSV()`: Tạo file CSV trực tiếp từ dữ liệu log hiện có để người dùng tải về máy tính.
4. **PolicySettingsPage**:
   - `handleSavePolicies(values)`: Xác thực form, cập nhật vào LocalStorage, ghi audit log `POLICY_CONFIG_UPDATED`.
   - Tích hợp vào `BookingFormPage`: Khi mở form đặt phòng, hàm validation sẽ kiểm tra ngày chọn $\le$ `max_advance_days` và khoảng thời gian $\le$ `max_duration_minutes`, cảnh báo trực quan cho người dùng nếu vi phạm.

---

### Kế hoạch Kiểm thử & Xác minh (Verification Plan)

#### 1. Kiểm tra Quản lý người dùng & Phân quyền (`/admin/users`)
- Đăng nhập với tài khoản Admin (`ADMINISTRATOR`).
- Kiểm tra danh sách hiển thị đầy đủ nhân viên từ các phòng ban.
- Thay đổi vai trò của một nhân viên từ `EMPLOYEE` thành `ROOM_MANAGER` -> Xác nhận hiển thị cập nhật tức thì.
- Chuyển sang tài khoản đó (hoặc đổi role tạm thời) để kiểm tra thanh menu Sidebar xuất hiện thêm các mục Quản lý phòng & Thiết bị.
- Kiểm tra nút Khóa tài khoản -> Tài khoản bị khóa hiển thị nhãn `Đã khóa` rõ ràng.

#### 2. Kiểm tra Quản lý phòng & Thẩm quyền ghi đè (`/admin/rooms`)
- Tạo một cuộc họp đang diễn ra tại Phòng Thăng Long.
- Với vai trò Admin, bấm nút "Cưỡng chế giải phóng phòng" (Force Release).
- Xác nhận cuộc họp chuyển sang trạng thái đã hủy và phòng trở lại trạng thái Sẵn sàng.
- Đặt phòng vào chế độ Bảo trì -> Xác nhận phòng không thể đặt được trên trang tìm kiếm phòng.

#### 3. Kiểm tra Nhật ký hoạt động (`/admin/audit-logs`)
- Thực hiện một loạt thao tác: đổi vai trò, đổi chính sách đặt phòng, hủy phòng.
- Mở trang `/admin/audit-logs` -> Xác nhận từng sự kiện xuất hiện đầy đủ thời gian (tabular numerals), người thao tác, hành động và nội dung chi tiết.
- Sử dụng bộ lọc theo Người thao tác hoặc theo Loại hành động -> Xác nhận bảng lọc đúng kết quả.
- Bấm nút "Xuất CSV" -> Tải xuống tệp `.csv` với nội dung log hợp lệ.

#### 4. Kiểm tra Cấu hình quy định đặt phòng (`/admin/settings`)
- Đổi số ngày đặt trước tối đa thành 7 ngày và thời lượng tối đa thành 120 phút -> Bấm Lưu.
- Vào trang Đặt phòng mới (`/bookings/new`) -> Thử chọn ngày thứ 10 hoặc đặt cuộc họp 4 tiếng -> Xác nhận form hiển thị thông báo lỗi giới hạn của hệ thống rõ ràng.
- Kiểm tra thiết lập tự động hủy trễ Check-in được lưu trữ an toàn.

#### 5. Đảm bảo chất lượng mã nguồn & Build
- Kiểm tra Dark & Light mode trên toàn bộ các trang Admin mới.
- Chạy `lint_applet` (`tsc --noEmit`) đạt 0 lỗi TypeScript.
- Chạy `compile_applet` (`npm run build`) xác nhận hệ thống biên dịch thành công 100%.
