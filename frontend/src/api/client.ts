import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import {
  Room,
  Booking,
  PaginatedResponse,
  BookingFilterParams,
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
  INITIAL_EQUIPMENT,
  INITIAL_USER_ACCOUNTS,
  INITIAL_AUDIT_LOGS,
  DEFAULT_BOOKING_POLICIES,
} from './mockData';

// Rooms API — calls room-service over HTTP
export * from './rooms';

dayjs.extend(isBetween);

const ROOMS_STORAGE_KEY = 'mrms_rooms_v1';
const BOOKINGS_STORAGE_KEY = 'mrms_bookings_v1';
const EQUIPMENT_STORAGE_KEY = 'mrms_equipment_v1';
const USERS_STORAGE_KEY = 'mrms_users_accounts_v1';
const AUDIT_LOGS_STORAGE_KEY = 'mrms_audit_logs_v1';
const POLICIES_STORAGE_KEY = 'mrms_booking_policies_v1';

const getStoredEquipment = (): EquipmentItem[] => {
  try {
    const raw = localStorage.getItem(EQUIPMENT_STORAGE_KEY);
    if (raw) {
      const parsed: EquipmentItem[] = JSON.parse(raw);
      return parsed.map((item) => {
        const room_ids = item.room_ids && item.room_ids.length > 0
          ? item.room_ids
          : item.room_id ? [item.room_id] : [];
        const room_names = item.room_names && item.room_names.length > 0
          ? item.room_names
          : item.room_name ? [item.room_name] : [];
        return {
          ...item,
          room_ids,
          room_names,
          room_id: room_ids[0] ?? null,
          room_name: room_names[0] ?? null,
        };
      });
    }
  } catch (e) {
    console.error('Error reading equipment from storage', e);
  }
  localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(INITIAL_EQUIPMENT));
  return INITIAL_EQUIPMENT;
};

const saveStoredEquipment = (equipment: EquipmentItem[]): void => {
  localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(equipment));
};

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

// Check-in helper: window ±15 minutes of start_at
export const isCheckInEligible = (startAt: string): boolean => {
  const now = dayjs();
  const startTime = dayjs(startAt);
  const diffMinutes = Math.abs(now.diff(startTime, 'minute'));
  return diffMinutes <= 15;
};

// Simulated network delay
const delay = (ms: number = 150) => new Promise((resolve) => setTimeout(resolve, ms));

// ==================== BOOKING SERVICE ====================

export const getBookings = async (
  params: BookingFilterParams = {}
): Promise<PaginatedResponse<Booking>> => {
  await delay();
  let bookings = getStoredBookings();

  if (params.status && params.status !== 'ALL') {
    bookings = bookings.filter((b) => b.status === params.status);
  }

  if (params.userId) {
    bookings = bookings.filter((b) => b.user_id === params.userId);
  }

  if (params.roomId) {
    bookings = bookings.filter((b) => b.room_id === params.roomId);
  }

  if (params.startDate) {
    bookings = bookings.filter(
      (b) => dayjs(b.start_at).isAfter(dayjs(params.startDate)) || dayjs(b.start_at).isSame(dayjs(params.startDate), 'day')
    );
  }

  if (params.endDate) {
    bookings = bookings.filter(
      (b) => dayjs(b.end_at).isBefore(dayjs(params.endDate)) || dayjs(b.end_at).isSame(dayjs(params.endDate), 'day')
    );
  }

  if (params.q) {
    const q = params.q.toLowerCase().trim();
    bookings = bookings.filter(
      (b) =>
        (b.room_name && b.room_name.toLowerCase().includes(q)) ||
        (b.user_name && b.user_name.toLowerCase().includes(q)) ||
        (b.user_email && b.user_email.toLowerCase().includes(q)) ||
        (b.purpose && b.purpose.toLowerCase().includes(q)) ||
        b.attendees.some((att) => att.name.toLowerCase().includes(q) || att.attendee_email.toLowerCase().includes(q))
    );
  }

  // Sort by start_at descending by default
  bookings.sort((a, b) => dayjs(b.start_at).valueOf() - dayjs(a.start_at).valueOf());

  const total = bookings.length;
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  const items = bookings.slice(offset, offset + limit);

  return { items, total, limit, offset };
};

export const getBookingById = async (id: number): Promise<Booking> => {
  await delay();
  const bookings = getStoredBookings();
  const found = bookings.find((b) => b.id === id);
  if (!found) {
    throw new Error(`Không tìm thấy booking với ID: ${id}`);
  }
  return found;
};

export const createBooking = async (
  data: Partial<Booking>
): Promise<Booking> => {
  await delay();
  const bookings = getStoredBookings();
  const rooms = getStoredRooms();

  if (!data.room_id || !data.start_at || !data.end_at) {
    const err: any = new Error('Dữ liệu đặt phòng không hợp lệ (422)');
    err.status = 422;
    throw err;
  }

  const room = rooms.find((r) => r.id === data.room_id);
  if (!room) {
    const err: any = new Error('Phòng họp không tồn tại');
    err.status = 422;
    throw err;
  }

  if (room.status !== 'AVAILABLE') {
    const err: any = new Error('Phòng họp hiện không khả dụng (đang bảo trì hoặc lưu trữ)');
    err.status = 422;
    throw err;
  }

  const newStart = dayjs(data.start_at);
  const newEnd = dayjs(data.end_at);

  if (newEnd.isBefore(newStart) || newEnd.isSame(newStart)) {
    const err: any = new Error('Thời gian kết thúc phải sau thời gian bắt đầu (422)');
    err.status = 422;
    throw err;
  }

  // Conflict Check (409)
  const hasConflict = bookings.some((b) => {
    if (b.room_id !== data.room_id) return false;
    if (b.status === 'CANCELLED') return false;

    const existStart = dayjs(b.start_at);
    const existEnd = dayjs(b.end_at);

    // Overlap condition: start < existEnd && end > existStart
    return newStart.isBefore(existEnd) && newEnd.isAfter(existStart);
  });

  if (hasConflict) {
    const err: any = new Error('Phòng đã được đặt trong khung giờ này (409)');
    err.status = 409;
    throw err;
  }

  const newId = bookings.length > 0 ? Math.max(...bookings.map((b) => b.id)) + 1 : 101;
  const now = new Date().toISOString();

  const newBooking: Booking = {
    id: newId,
    room_id: data.room_id,
    room_name: room.name,
    user_id: data.user_id || 'user_admin_01',
    user_name: data.user_name || 'Nguyễn Văn An (Admin)',
    user_email: data.user_email || 'an.nguyen@company.com',
    start_at: data.start_at,
    end_at: data.end_at,
    num_attendees: data.num_attendees || 1,
    status: 'CONFIRMED',
    checked_in_at: null,
    auto_cancelled_at: null,
    purpose: data.purpose || 'Họp công việc nội bộ',
    attendees: data.attendees || [],
    created_at: now,
    updated_at: now,
  };

  bookings.unshift(newBooking);
  saveStoredBookings(bookings);
  return newBooking;
};

export const checkInBooking = async (id: number): Promise<Booking> => {
  await delay();
  const bookings = getStoredBookings();
  const index = bookings.findIndex((b) => b.id === id);
  if (index === -1) {
    throw new Error('Không tìm thấy booking');
  }

  const target = bookings[index];
  if (target.status !== 'CONFIRMED') {
    throw new Error('Chỉ có thể check-in cho booking có trạng thái Đã xác nhận');
  }

  const now = new Date().toISOString();
  const updated: Booking = {
    ...target,
    status: 'CHECKED_IN',
    checked_in_at: now,
    updated_at: now,
  };

  bookings[index] = updated;
  saveStoredBookings(bookings);
  return updated;
};

export const cancelBooking = async (id: number): Promise<Booking> => {
  await delay();
  const bookings = getStoredBookings();
  const index = bookings.findIndex((b) => b.id === id);
  if (index === -1) {
    throw new Error('Không tìm thấy booking');
  }

  const target = bookings[index];
  const now = new Date().toISOString();
  const updated: Booking = {
    ...target,
    status: 'CANCELLED',
    updated_at: now,
  };

  bookings[index] = updated;
  saveStoredBookings(bookings);
  return updated;
};

export const updateBooking = async (
  id: number,
  data: Partial<Booking>
): Promise<Booking> => {
  await delay();
  const bookings = getStoredBookings();
  const index = bookings.findIndex((b) => b.id === id);
  if (index === -1) {
    const err: any = new Error(`Không tìm thấy booking với ID: ${id}`);
    err.status = 404;
    throw err;
  }

  const existing = bookings[index];
  if (existing.status !== 'CONFIRMED') {
    const err: any = new Error('Không thể sửa lịch đã check-in hoặc đã hủy (409)');
    err.status = 409;
    throw err;
  }

  const rooms = getStoredRooms();
  const targetRoomId = data.room_id !== undefined ? data.room_id : existing.room_id;
  const room = rooms.find((r) => r.id === targetRoomId);
  if (!room) {
    const err: any = new Error('Phòng họp không tồn tại');
    err.status = 422;
    throw err;
  }

  const newStart = dayjs(data.start_at || existing.start_at);
  const newEnd = dayjs(data.end_at || existing.end_at);

  if (newEnd.isBefore(newStart) || newEnd.isSame(newStart)) {
    const err: any = new Error('Thời gian kết thúc phải sau thời gian bắt đầu (422)');
    err.status = 422;
    throw err;
  }

  // Conflict Check (409) against OTHER bookings in the same room
  const hasConflict = bookings.some((b) => {
    if (b.id === id) return false;
    if (b.room_id !== targetRoomId) return false;
    if (b.status === 'CANCELLED') return false;

    const existStart = dayjs(b.start_at);
    const existEnd = dayjs(b.end_at);

    return newStart.isBefore(existEnd) && newEnd.isAfter(existStart);
  });

  if (hasConflict) {
    const err: any = new Error('Phòng đã được đặt trong khung giờ này (409)');
    err.status = 409;
    throw err;
  }

  const now = new Date().toISOString();
  const updated: Booking = {
    ...existing,
    ...data,
    id,
    room_id: targetRoomId,
    room_name: room.name,
    start_at: newStart.toISOString(),
    end_at: newEnd.toISOString(),
    updated_at: now,
  };

  bookings[index] = updated;
  saveStoredBookings(bookings);
  return updated;
};

// ==================== EQUIPMENT SERVICE ====================

export interface EquipmentFilterParams {
  q?: string;
  category?: string;
  status?: string;
  roomId?: number | 'ALL' | 'UNASSIGNED';
}

export const getEquipmentList = async (params: EquipmentFilterParams = {}): Promise<EquipmentItem[]> => {
  await delay();
  let items = getStoredEquipment();

  if (params.q) {
    const qLower = params.q.toLowerCase().trim();
    items = items.filter(
      (item) =>
        item.name.toLowerCase().includes(qLower) ||
        item.id.toLowerCase().includes(qLower) ||
        (item.serial_number && item.serial_number.toLowerCase().includes(qLower)) ||
        (item.room_name && item.room_name.toLowerCase().includes(qLower)) ||
        (item.room_names && item.room_names.some((rn) => rn.toLowerCase().includes(qLower))) ||
        item.category.toLowerCase().includes(qLower)
    );
  }

  if (params.category && params.category !== 'ALL') {
    items = items.filter((item) => item.category === params.category);
  }

  if (params.status && params.status !== 'ALL') {
    items = items.filter((item) => item.status === params.status);
  }

  if (params.roomId !== undefined && params.roomId !== 'ALL') {
    if (params.roomId === 'UNASSIGNED') {
      items = items.filter((item) => !item.room_ids || item.room_ids.length === 0);
    } else {
      items = items.filter(
        (item) =>
          (item.room_ids && item.room_ids.includes(params.roomId as number)) ||
          item.room_id === params.roomId
      );
    }
  }

  return items;
};

export const getEquipmentByRoom = async (roomId: number): Promise<EquipmentItem[]> => {
  await delay();
  const items = getStoredEquipment();
  return items.filter(
    (item) =>
      (item.room_ids && item.room_ids.includes(roomId)) ||
      item.room_id === roomId
  );
};

export const createEquipment = async (
  data: Omit<EquipmentItem, 'id' | 'updated_at'>
): Promise<EquipmentItem> => {
  await delay();
  const items = getStoredEquipment();
  const newId = `EQ-${String(items.length + 1).padStart(3, '0')}`;
  const rooms = getStoredRooms();

  const roomIds = data.room_ids && data.room_ids.length > 0
    ? data.room_ids
    : data.room_id ? [data.room_id] : [];

  let roomNames = data.room_names;
  if (!roomNames || roomNames.length === 0) {
    roomNames = roomIds.map((rid) => rooms.find((r) => r.id === rid)?.name).filter(Boolean) as string[];
  }

  const primaryRoomId = roomIds[0] ?? null;
  const primaryRoomName = roomNames[0] ?? null;

  const newItem: EquipmentItem = {
    ...data,
    id: newId,
    room_id: primaryRoomId,
    room_name: primaryRoomName,
    room_ids: roomIds,
    room_names: roomNames,
    updated_at: new Date().toISOString(),
  };

  items.unshift(newItem);
  saveStoredEquipment(items);

  // Sync with rooms' equipment lists for all assigned rooms
  if (roomIds.length > 0) {
    let roomsUpdated = false;
    roomIds.forEach((rid) => {
      const rIdx = rooms.findIndex((r) => r.id === rid);
      if (rIdx !== -1 && !rooms[rIdx].equipment.includes(newItem.category)) {
        rooms[rIdx].equipment.push(newItem.category);
        roomsUpdated = true;
      }
    });
    if (roomsUpdated) saveStoredRooms(rooms);
  }

  return newItem;
};

export const updateEquipment = async (
  id: string,
  data: Partial<EquipmentItem>
): Promise<EquipmentItem> => {
  await delay();
  const items = getStoredEquipment();
  const index = items.findIndex((e) => e.id === id);
  if (index === -1) {
    throw new Error('Không tìm thấy thiết bị');
  }

  const existing = items[index];
  const rooms = getStoredRooms();

  let roomIds = data.room_ids !== undefined
    ? data.room_ids
    : (data.room_id !== undefined
        ? (data.room_id ? [data.room_id] : [])
        : (existing.room_ids || (existing.room_id ? [existing.room_id] : [])));

  let roomNames = data.room_names;
  if (data.room_ids !== undefined && (!roomNames || roomNames.length === 0)) {
    roomNames = roomIds.map((rid) => rooms.find((r) => r.id === rid)?.name).filter(Boolean) as string[];
  } else if (!roomNames) {
    roomNames = existing.room_names || (existing.room_name ? [existing.room_name] : []);
  }

  const primaryRoomId = roomIds[0] ?? null;
  const primaryRoomName = roomNames[0] ?? null;

  const updated: EquipmentItem = {
    ...existing,
    ...data,
    room_id: primaryRoomId,
    room_name: primaryRoomName,
    room_ids: roomIds,
    room_names: roomNames,
    updated_at: new Date().toISOString(),
  };

  items[index] = updated;
  saveStoredEquipment(items);
  return updated;
};

export const deleteEquipment = async (id: string): Promise<void> => {
  await delay();
  const items = getStoredEquipment();
  const filtered = items.filter((e) => e.id !== id);
  saveStoredEquipment(filtered);
};

// ==================== USER ACCOUNTS & RBAC SERVICE ====================

const getStoredUsers = (): UserAccount[] => {
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
  localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(INITIAL_EQUIPMENT));
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(INITIAL_USER_ACCOUNTS));
  localStorage.setItem(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(INITIAL_AUDIT_LOGS));
  localStorage.setItem(POLICIES_STORAGE_KEY, JSON.stringify(DEFAULT_BOOKING_POLICIES));
};
