import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import {
  Room,
  Booking,
  EquipmentItem,
  UserAccount,
  AuditLogEntry,
  BookingPolicyConfig,
  UserRole,
  AuditActionType,
} from '../types';
import {
  INITIAL_ROOMS,
  generateInitialBookings,
  INITIAL_USER_ACCOUNTS,
  INITIAL_AUDIT_LOGS,
  DEFAULT_BOOKING_POLICIES,
} from './mockData';
import { request } from './http';

// Rooms API — calls room-service over HTTP
export * from './rooms';

// Bookings API — calls booking-service over HTTP
export * from './bookings';

dayjs.extend(isBetween);

const ROOMS_STORAGE_KEY = 'mrms_rooms_v1';
const BOOKINGS_STORAGE_KEY = 'mrms_bookings_v1';
const EQUIPMENT_STORAGE_KEY = 'mrms_equipment_v1'; // kept to clear legacy data
const USERS_STORAGE_KEY = 'mrms_users_accounts_v1';
const AUDIT_LOGS_STORAGE_KEY = 'mrms_audit_logs_v1';
const POLICIES_STORAGE_KEY = 'mrms_booking_policies_v1';

// Convert backend EquipmentResponse to frontend EquipmentItem shape
interface BackendEquipmentRoom { room_id: number; room_name: string | null }
interface BackendEquipmentResponse {
  id: number;
  name: string;
  category: string;
  status: string;
  serial_number: string | null;
  notes: string | null;
  rooms: BackendEquipmentRoom[];
  created_at: string;
  updated_at: string;
}

function adaptEquipment(raw: BackendEquipmentResponse): EquipmentItem {
  const room_ids = raw.rooms.map((r) => r.room_id);
  const room_names = raw.rooms.map((r) => r.room_name ?? '').filter(Boolean);
  return {
    id: String(raw.id),
    name: raw.name,
    category: raw.category,
    status: raw.status as EquipmentItem['status'],
    serial_number: raw.serial_number ?? undefined,
    notes: raw.notes ?? undefined,
    room_ids,
    room_names,
    room_id: room_ids[0] ?? null,
    room_name: room_names[0] ?? null,
    updated_at: raw.updated_at,
  } as unknown as EquipmentItem;
}

// Initialize LocalStorage with mock data if not present
const getStoredRooms = (): Room[] => {
  try {
    const raw = localStorage.getItem(ROOMS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading rooms from storage', e);
  }
  localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(INITIAL_ROOMS));
  return INITIAL_ROOMS;
};

const saveStoredRooms = (rooms: Room[]): void => {
  localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(rooms));
};

const getStoredBookings = (): Booking[] => {
  try {
    const raw = localStorage.getItem(BOOKINGS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading bookings from storage', e);
  }
  const initial = generateInitialBookings();
  localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(initial));
  return initial;
};

const saveStoredBookings = (bookings: Booking[]): void => {
  localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(bookings));
};

// Simulated network delay (for mock-only services below)
const delay = (ms: number = 150) => new Promise((resolve) => setTimeout(resolve, ms));

// ==================== EQUIPMENT SERVICE ====================

export interface EquipmentFilterParams {
  q?: string;
  category?: string;
  status?: string;
  roomId?: number | 'ALL' | 'UNASSIGNED';
}

export const getEquipmentList = async (params: EquipmentFilterParams = {}): Promise<EquipmentItem[]> => {
  const queryParams: Record<string, string | number | undefined> = {};
  if (params.q) queryParams.q = params.q;
  if (params.category && params.category !== 'ALL') queryParams.category = params.category;
  if (params.status && params.status !== 'ALL') queryParams.status = params.status;
  if (params.roomId !== undefined && params.roomId !== 'ALL') {
    queryParams.room_id = params.roomId === 'UNASSIGNED' ? -1 : (params.roomId as number);
  }

  const resp = await request<{ items: BackendEquipmentResponse[]; total: number }>(
    '/rooms/equipment',
    { params: queryParams }
  );
  return resp.items.map(adaptEquipment);
};

export const getEquipmentByRoom = async (roomId: number): Promise<EquipmentItem[]> => {
  const resp = await request<BackendEquipmentResponse[]>(`/rooms/${roomId}/equipment`);
  return resp.map(adaptEquipment);
};

export const createEquipment = async (
  data: Omit<EquipmentItem, 'id' | 'updated_at'>
): Promise<EquipmentItem> => {
  const body = {
    name: data.name,
    category: data.category,
    status: data.status,
    serial_number: data.serial_number ?? null,
    notes: data.notes ?? null,
    room_ids: data.room_ids && data.room_ids.length > 0
      ? data.room_ids
      : (data.room_id ? [data.room_id] : []),
  };
  const resp = await request<BackendEquipmentResponse>('/rooms/equipment', { method: 'POST', body });
  return adaptEquipment(resp);
};

export const updateEquipment = async (
  id: string,
  data: Partial<EquipmentItem>
): Promise<EquipmentItem> => {
  const body: Record<string, unknown> = {};
  if (data.name !== undefined) body.name = data.name;
  if (data.category !== undefined) body.category = data.category;
  if (data.status !== undefined) body.status = data.status;
  if (data.serial_number !== undefined) body.serial_number = data.serial_number;
  if (data.notes !== undefined) body.notes = data.notes;
  if (data.room_ids !== undefined) {
    body.room_ids = data.room_ids;
  } else if (data.room_id !== undefined) {
    body.room_ids = data.room_id ? [data.room_id] : [];
  }

  const numericId = parseInt(id, 10);
  const resp = await request<BackendEquipmentResponse>(`/rooms/equipment/${numericId}`, {
    method: 'PATCH',
    body,
  });
  return adaptEquipment(resp);
};

export const deleteEquipment = async (id: string): Promise<void> => {
  const numericId = parseInt(id, 10);
  await request<void>(`/rooms/equipment/${numericId}`, { method: 'DELETE' });
};

// ==================== USER ACCOUNTS & RBAC SERVICE ====================

export const getStoredUsers = (): UserAccount[] => {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading users from storage', e);
  }
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(INITIAL_USER_ACCOUNTS));
  return INITIAL_USER_ACCOUNTS;
};

const saveStoredUsers = (users: UserAccount[]): void => {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

export const patchUserAccountById = (userId: string, data: Partial<UserAccount>): void => {
  const users = getStoredUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx !== -1) {
    users[idx] = { ...users[idx], ...data };
    saveStoredUsers(users);
  }
};

export const getUserAccounts = async (params: {
  q?: string;
  role?: UserRole | 'ALL';
  status?: 'ACTIVE' | 'SUSPENDED' | 'ALL';
  department?: string;
} = {}): Promise<UserAccount[]> => {
  await delay();
  let users = getStoredUsers();

  if (params.q) {
    const q = params.q.toLowerCase().trim();
    users = users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q)
    );
  }

  if (params.role && params.role !== 'ALL') {
    users = users.filter((u) => u.role === params.role);
  }

  if (params.status && params.status !== 'ALL') {
    users = users.filter((u) => u.status === params.status);
  }

  if (params.department && params.department !== 'ALL') {
    users = users.filter((u) => u.department === params.department);
  }

  return users;
};

export const updateUserRole = async (
  userId: string,
  newRole: UserRole,
  actor: { id: string; name: string; role: UserRole }
): Promise<UserAccount> => {
  await delay();
  const users = getStoredUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) {
    const err: any = new Error('Người dùng không tồn tại');
    err.status = 404;
    throw err;
  }

  const oldRole = users[index].role;
  users[index] = {
    ...users[index],
    role: newRole,
  };
  saveStoredUsers(users);

  // Auto record audit log
  await logAuditEvent({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    action_type: 'USER_ROLE_CHANGED',
    target_id: userId,
    target_name: users[index].name,
    details: `Thay đổi vai trò từ ${oldRole} thành ${newRole}`,
  });

  return users[index];
};

export const toggleUserStatus = async (
  userId: string,
  actor: { id: string; name: string; role: UserRole }
): Promise<UserAccount> => {
  await delay();
  const users = getStoredUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) {
    const err: any = new Error('Người dùng không tồn tại');
    err.status = 404;
    throw err;
  }

  const newStatus = users[index].status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
  users[index] = {
    ...users[index],
    status: newStatus,
  };
  saveStoredUsers(users);

  await logAuditEvent({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    action_type: 'USER_STATUS_TOGGLED',
    target_id: userId,
    target_name: users[index].name,
    details: newStatus === 'ACTIVE' ? 'Kích hoạt lại tài khoản' : 'Khóa truy cập tài khoản người dùng',
  });

  return users[index];
};

export const createUserAccount = async (
  data: Omit<UserAccount, 'id' | 'created_at'>,
  actor: { id: string; name: string; role: UserRole }
): Promise<UserAccount> => {
  await delay();
  const users = getStoredUsers();
  const newId = `user_${Date.now()}`;
  const newUser: UserAccount = {
    ...data,
    id: newId,
    created_at: new Date().toISOString(),
  };

  users.unshift(newUser);
  saveStoredUsers(users);

  await logAuditEvent({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    action_type: 'USER_CREATED',
    target_id: newId,
    target_name: newUser.name,
    details: `Tạo tài khoản mới với vai trò ${newUser.role} thuộc ${newUser.department}`,
  });

  return newUser;
};

// ==================== AUDIT LOG SERVICE ====================

const getStoredAuditLogs = (): AuditLogEntry[] => {
  try {
    const raw = localStorage.getItem(AUDIT_LOGS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading audit logs from storage', e);
  }
  localStorage.setItem(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(INITIAL_AUDIT_LOGS));
  return INITIAL_AUDIT_LOGS;
};

const saveStoredAuditLogs = (logs: AuditLogEntry[]): void => {
  localStorage.setItem(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(logs));
};

export const getAuditLogs = async (filters: {
  actorId?: string;
  actionType?: string;
  startDate?: string;
  endDate?: string;
  q?: string;
} = {}): Promise<AuditLogEntry[]> => {
  await delay();
  let logs = getStoredAuditLogs();

  if (filters.q) {
    const q = filters.q.toLowerCase().trim();
    logs = logs.filter(
      (l) =>
        l.actor_name.toLowerCase().includes(q) ||
        (l.target_name && l.target_name.toLowerCase().includes(q)) ||
        l.details.toLowerCase().includes(q)
    );
  }

  if (filters.actorId && filters.actorId !== 'ALL') {
    logs = logs.filter((l) => l.actor_id === filters.actorId);
  }

  if (filters.actionType && filters.actionType !== 'ALL') {
    logs = logs.filter((l) => l.action_type === filters.actionType);
  }

  if (filters.startDate) {
    logs = logs.filter((l) => dayjs(l.timestamp).isAfter(dayjs(filters.startDate).startOf('day')));
  }

  if (filters.endDate) {
    logs = logs.filter((l) => dayjs(l.timestamp).isBefore(dayjs(filters.endDate).endOf('day')));
  }

  // Sort descending by timestamp
  return logs.sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf());
};

export const logAuditEvent = async (
  event: Omit<AuditLogEntry, 'id' | 'timestamp'>
): Promise<AuditLogEntry> => {
  const logs = getStoredAuditLogs();
  const newEntry: AuditLogEntry = {
    ...event,
    id: `LOG-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ip_address: '10.0.4.12',
  };

  logs.unshift(newEntry);
  saveStoredAuditLogs(logs);
  return newEntry;
};

export const exportAuditLogsToCsv = (logs: AuditLogEntry[]): void => {
  const headers = ['Mã Log', 'Thời gian', 'Người thực hiện', 'Vai trò', 'Hành động', 'Đối tượng', 'Chi tiết'];
  const rows = logs.map((l) => [
    `"${l.id}"`,
    `"${dayjs(l.timestamp).format('YYYY-MM-DD HH:mm:ss')}"`,
    `"${l.actor_name}"`,
    `"${l.actor_role}"`,
    `"${l.action_type}"`,
    `"${l.target_name || ''}"`,
    `"${l.details.replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `audit_logs_${dayjs().format('YYYYMMDD_HHmmss')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ==================== BOOKING POLICY SERVICE ====================

const getStoredPolicies = (): BookingPolicyConfig => {
  try {
    const raw = localStorage.getItem(POLICIES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading policies from storage', e);
  }
  localStorage.setItem(POLICIES_STORAGE_KEY, JSON.stringify(DEFAULT_BOOKING_POLICIES));
  return DEFAULT_BOOKING_POLICIES;
};

const saveStoredPolicies = (policies: BookingPolicyConfig): void => {
  localStorage.setItem(POLICIES_STORAGE_KEY, JSON.stringify(policies));
};

export const getBookingPolicies = async (): Promise<BookingPolicyConfig> => {
  await delay();
  return getStoredPolicies();
};

export const updateBookingPolicies = async (
  newPolicy: BookingPolicyConfig,
  actor: { id: string; name: string; role: UserRole }
): Promise<BookingPolicyConfig> => {
  await delay();
  const updated: BookingPolicyConfig = {
    ...newPolicy,
    updated_at: new Date().toISOString(),
    updated_by_name: `${actor.name} (${actor.role})`,
  };
  saveStoredPolicies(updated);

  await logAuditEvent({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    action_type: 'POLICY_CONFIG_UPDATED',
    target_id: 'policy_system',
    target_name: 'Quy định đặt phòng toàn hệ thống',
    details: `Cập nhật cấu hình: Đặt trước tối đa ${updated.max_advance_days} ngày, Thời lượng tối đa ${updated.max_duration_minutes} phút, Tự hủy sau ${updated.auto_release_grace_minutes} phút trễ check-in`,
  });

  return updated;
};

export const resetBookingPolicies = async (
  actor: { id: string; name: string; role: UserRole }
): Promise<BookingPolicyConfig> => {
  await delay();
  const resetConfig: BookingPolicyConfig = {
    ...DEFAULT_BOOKING_POLICIES,
    updated_at: new Date().toISOString(),
    updated_by_name: `${actor.name} (${actor.role})`,
  };
  saveStoredPolicies(resetConfig);

  await logAuditEvent({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    action_type: 'POLICY_CONFIG_UPDATED',
    target_id: 'policy_system',
    target_name: 'Quy định đặt phòng toàn hệ thống',
    details: 'Khôi phục quy định đặt phòng về thông số mặc định của hệ thống',
  });

  return resetConfig;
};

// ==================== GLOBAL ROOM ADMIN OVERRIDE ====================

export const forceReleaseRoom = async (
  roomId: number,
  reason: string,
  actor: { id: string; name: string; role: UserRole }
): Promise<{ room: Room; cancelledBookingsCount: number }> => {
  await delay();
  const rooms = getStoredRooms();
  const roomIndex = rooms.findIndex((r) => r.id === roomId);
  if (roomIndex === -1) {
    const err: any = new Error('Phòng không tồn tại');
    err.status = 404;
    throw err;
  }

  const room = rooms[roomIndex];
  const bookings = getStoredBookings();
  const now = dayjs();

  // Find active/ongoing confirmed bookings for this room right now
  let cancelledCount = 0;
  const updatedBookings = bookings.map((b) => {
    if (b.room_id === roomId && (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN')) {
      const start = dayjs(b.start_at);
      const end = dayjs(b.end_at);
      // If ongoing or upcoming today
      if (now.isBetween(start, end, null, '[]') || (start.isSame(now, 'day') && start.isAfter(now))) {
        cancelledCount++;
        return {
          ...b,
          status: 'CANCELLED' as const,
          purpose: b.purpose ? `${b.purpose} [Cưỡng chế hủy bởi Admin: ${reason}]` : `[Cưỡng chế hủy bởi Admin: ${reason}]`,
          updated_at: new Date().toISOString(),
        };
      }
    }
    return b;
  });

  saveStoredBookings(updatedBookings);

  // Ensure room is available
  if (room.status !== 'AVAILABLE') {
    room.status = 'AVAILABLE';
    rooms[roomIndex] = room;
    saveStoredRooms(rooms);
  }

  await logAuditEvent({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    action_type: 'ROOM_FORCE_RELEASED',
    target_id: roomId,
    target_name: room.name,
    details: `Admin cưỡng chế giải phóng phòng. Lý do: ${reason}. Đã hủy ${cancelledCount} lịch liên quan.`,
  });

  return { room, cancelledBookingsCount: cancelledCount };
};

export const toggleRoomMaintenance = async (
  roomId: number,
  maintenance: boolean,
  reason: string,
  actor: { id: string; name: string; role: UserRole }
): Promise<Room> => {
  await delay();
  const rooms = getStoredRooms();
  const index = rooms.findIndex((r) => r.id === roomId);
  if (index === -1) {
    const err: any = new Error('Phòng không tồn tại');
    err.status = 404;
    throw err;
  }

  const newStatus = maintenance ? 'MAINTENANCE' : 'AVAILABLE';
  rooms[index] = {
    ...rooms[index],
    status: newStatus,
    updated_at: new Date().toISOString(),
  };
  saveStoredRooms(rooms);

  await logAuditEvent({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    action_type: 'ROOM_MAINTENANCE_TOGGLED',
    target_id: roomId,
    target_name: rooms[index].name,
    details: maintenance
      ? `Chuyển sang ĐANG BẢO TRÌ. Lý do: ${reason || 'Bảo trì định kỳ'}`
      : `Hoàn tất bảo trì, đưa phòng trở lại hoạt động. Ghi chú: ${reason || 'Đã kiểm tra kỹ thuật'}`,
  });

  return rooms[index];
};

export const resetMockDataToDefault = (): void => {
  localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(INITIAL_ROOMS));
  localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(generateInitialBookings()));
  localStorage.removeItem(EQUIPMENT_STORAGE_KEY); // equipment migrated to real DB
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(INITIAL_USER_ACCOUNTS));
  localStorage.setItem(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(INITIAL_AUDIT_LOGS));
  localStorage.setItem(POLICIES_STORAGE_KEY, JSON.stringify(DEFAULT_BOOKING_POLICIES));
};
