import type { UserRole } from '../types';

/**
 * Định danh cho từng widget trên dashboard manager/admin.
 * Quy ước đặt tên: <nhóm>.<tên>
 *   kpi.*      — 4 ô KPI trên cùng (Manager/Admin)
 *   stats.*    — biểu đồ và bảng thống kê theo kỳ
 *   admin.*    — widget chỉ dành cho ADMINISTRATOR
 */
export type DashboardWidget =
  | 'kpi.rooms'
  | 'kpi.todayBookings'
  | 'kpi.upcomingCheckIns'
  | 'kpi.equipment'   // Manager: donut thiết bị ở ô KPI
  | 'kpi.utilization' // Admin: tỷ lệ sử dụng ở ô KPI
  | 'stats.trend'
  | 'stats.statusDonut'
  | 'stats.peakHours'
  | 'stats.topRooms'
  | 'stats.equipment' // Admin: donut thiết bị ở Row 3 (Manager đã có ở kpi.equipment)
  | 'stats.rates'
  | 'admin.users'
  | 'admin.auditLogs'
  | 'admin.policyConfig';

const MANAGER_WIDGETS: DashboardWidget[] = [
  'kpi.rooms',
  'kpi.todayBookings',
  'kpi.upcomingCheckIns',
  'kpi.equipment',      // thiết bị ở KPI (không có ở Row 3)
  'stats.trend',
  'stats.statusDonut',
  'stats.peakHours',
  'stats.topRooms',
  // không có stats.equipment (đã có kpi.equipment)
  'stats.rates',
];

const ADMIN_WIDGETS: DashboardWidget[] = [
  'kpi.rooms',
  'kpi.todayBookings',
  'kpi.upcomingCheckIns',
  'kpi.utilization',    // admin dùng utilization ở KPI
  'stats.trend',
  'stats.statusDonut',
  'stats.peakHours',
  'stats.topRooms',
  'stats.equipment',    // thiết bị ở Row 3 (không có kpi.equipment)
  'stats.rates',
  'admin.users',
  'admin.auditLogs',
  'admin.policyConfig',
];

/**
 * Trả về danh sách widget cần render cho role đã cho.
 * EMPLOYEE và undefined trả [] — nhánh EMPLOYEE tự xử lý riêng trong DashboardPage.
 */
export function getDashboardWidgets(role: UserRole | undefined): DashboardWidget[] {
  switch (role) {
    case 'ROOM_MANAGER':
      return MANAGER_WIDGETS;
    case 'ADMINISTRATOR':
      return ADMIN_WIDGETS;
    default:
      return [];
  }
}
