export type RoomStatus = 'AVAILABLE' | 'MAINTENANCE' | 'ARCHIVED';

export type BookingStatus = 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED';

export type UserRole = 'EMPLOYEE' | 'ROOM_MANAGER' | 'ADMINISTRATOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  phone?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  phone?: string;
  avatar?: string;
  status: 'ACTIVE' | 'SUSPENDED';
  created_at: string;
}

export type AuditActionType =
  | 'USER_ROLE_CHANGED'
  | 'USER_STATUS_TOGGLED'
  | 'USER_CREATED'
  | 'ROOM_CREATED'
  | 'ROOM_UPDATED'
  | 'ROOM_MAINTENANCE_TOGGLED'
  | 'ROOM_FORCE_RELEASED'
  | 'BOOKING_FORCE_CANCELLED'
  | 'POLICY_CONFIG_UPDATED'
  | 'EQUIPMENT_ALLOCATED';

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO 8601
  actor_id: string;
  actor_name: string;
  actor_role: UserRole;
  action_type: AuditActionType;
  target_id?: string | number;
  target_name?: string;
  details: string;
  ip_address?: string;
}

export interface BookingPolicyConfig {
  max_advance_days: number;           // Max days in advance to book (default 14)
  max_duration_minutes: number;       // Max single meeting duration (default 180)
  min_duration_minutes: number;       // Min duration (default 15)
  enable_auto_release_no_show: boolean; // Enable auto-cancellation if no check-in
  auto_release_grace_minutes: number;  // Grace minutes before auto-cancellation (default 15)
  buffer_minutes_between_meetings: number; // Buffer time between bookings (default 0)
  min_cancel_notice_minutes: number;  // Notice required to cancel (default 30)
  updated_at: string;
  updated_by_name: string;
}

export type EquipmentStatus = 'FUNCTIONAL' | 'UNDER_REPAIR' | 'DECOMMISSIONED';

export interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  room_id?: number | null;
  room_name?: string | null;
  room_ids?: number[];
  room_names?: string[];
  status: EquipmentStatus;
  serial_number?: string;
  notes?: string;
  updated_at?: string;
}

export const EQUIPMENT_STATUS_CONFIG: Record<EquipmentStatus, { color: string; label: string; labelEn: string; tagColor: string }> = {
  FUNCTIONAL: { color: 'success', label: 'Hoạt động tốt', labelEn: 'Functional', tagColor: '#52c41a' },
  UNDER_REPAIR: { color: 'warning', label: 'Đang bảo dưỡng/sửa chữa', labelEn: 'Under Repair', tagColor: '#faad14' },
  DECOMMISSIONED: { color: 'error', label: 'Ngừng sử dụng', labelEn: 'Decommissioned', tagColor: '#ff4d4f' },
};

export interface Attendee {
  id: number;
  attendee_email: string;
  name: string;
}

export interface Room {
  id: number;
  name: string;
  capacity: number;
  status: RoomStatus;
  equipment: string[];
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  floor?: string;
  description?: string;
}

export interface Booking {
  id: number;
  room_id: number;
  user_id: string;
  user_name?: string;
  user_email?: string;
  start_at: string; // ISO 8601 with timezone
  end_at: string;
  num_attendees: number;
  status: BookingStatus;
  checked_in_at: string | null;
  auto_cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  room_name: string | null;
  attendees: Attendee[];
  purpose?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface RoomFilterParams {
  status?: RoomStatus | 'ALL';
  q?: string;
  minCapacity?: number;
  equipment?: string[];
  limit?: number;
  offset?: number;
}

export interface BookingFilterParams {
  status?: BookingStatus | 'ALL';
  userId?: string;
  roomId?: number;
  startDate?: string;
  endDate?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export const ROOM_STATUS_CONFIG: Record<RoomStatus, { color: string; label: string; labelEn: string; badgeColor: string }> = {
  AVAILABLE: { color: 'success', label: 'Đang hoạt động', labelEn: 'Available', badgeColor: '#52c41a' },
  MAINTENANCE: { color: 'warning', label: 'Đang bảo trì', labelEn: 'Maintenance', badgeColor: '#faad14' },
  ARCHIVED: { color: 'default', label: 'Lưu trữ', labelEn: 'Archived', badgeColor: '#8c8c8c' },
};

export const BOOKING_STATUS_CONFIG: Record<BookingStatus, { color: string; label: string; labelEn: string; tagColor: string }> = {
  CONFIRMED: { color: 'processing', label: 'Đã xác nhận', labelEn: 'Confirmed', tagColor: '#1e5bef' },
  CHECKED_IN: { color: 'success', label: 'Đã check-in', labelEn: 'Checked In', tagColor: '#52c41a' },
  CANCELLED: { color: 'error', label: 'Đã hủy', labelEn: 'Cancelled', tagColor: '#ff4d4f' },
};

export const getRoomStatusLabel = (status: RoomStatus, lang: 'vi' | 'en' = 'vi'): string => {
  const cfg = ROOM_STATUS_CONFIG[status];
  if (!cfg) return status;
  return lang === 'en' ? cfg.labelEn : cfg.label;
};

export const getBookingStatusLabel = (status: BookingStatus, lang: 'vi' | 'en' = 'vi'): string => {
  const cfg = BOOKING_STATUS_CONFIG[status];
  if (!cfg) return status;
  return lang === 'en' ? cfg.labelEn : cfg.label;
};

export const STANDARD_EQUIPMENT = [
  'TV/Màn hình lớn',
  'Máy chiếu 4K',
  'Camera họp trực tuyến',
  'Microphone đa hướng',
  'Bảng trắng & bút viết',
  'Hệ thống âm thanh hội nghị',
  'Bút trình chiếu không dây',
];

export const EQUIPMENT_TRANSLATIONS: Record<string, { vi: string; en: string }> = {
  'TV/Màn hình lớn': { vi: 'TV/Màn hình lớn', en: 'TV / Large Display' },
  'Máy chiếu 4K': { vi: 'Máy chiếu 4K', en: '4K Projector' },
  'Camera họp trực tuyến': { vi: 'Camera họp trực tuyến', en: 'Video Conference Cam' },
  'Microphone đa hướng': { vi: 'Microphone đa hướng', en: 'Omnidirectional Mic' },
  'Bảng trắng & bút viết': { vi: 'Bảng trắng & bút viết', en: 'Whiteboard & Markers' },
  'Hệ thống âm thanh hội nghị': { vi: 'Hệ thống âm thanh hội nghị', en: 'Conference Audio' },
  'Bút trình chiếu không dây': { vi: 'Bút trình chiếu không dây', en: 'Wireless Presenter' },
};

export const getEquipmentLabel = (item: string, lang: 'vi' | 'en' = 'vi'): string => {
  if (EQUIPMENT_TRANSLATIONS[item]) {
    return EQUIPMENT_TRANSLATIONS[item][lang];
  }
  return item;
};

