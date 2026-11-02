import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import {
  Booking,
  PaginatedResponse,
  BookingFilterParams,
  EquipmentItem,
} from '../types';
import { generateInitialBookings, INITIAL_EQUIPMENT } from './mockData';

// Rooms API — calls room-service over HTTP
export * from './rooms';

dayjs.extend(isBetween);

const BOOKINGS_STORAGE_KEY = 'mrms_bookings_v1';
const EQUIPMENT_STORAGE_KEY = 'mrms_equipment_v1';

const getStoredEquipment = (): EquipmentItem[] => {
  try {
    const raw = localStorage.getItem(EQUIPMENT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
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

// Check-in window: ±15 minutes of start_at (will move to bookings.ts in Task 4)
export const isCheckInEligible = (startAt: string): boolean => {
  const now = dayjs();
  const startTime = dayjs(startAt);
  const diffMinutes = Math.abs(now.diff(startTime, 'minute'));
  return diffMinutes <= 15;
};

// Simulated network delay
const delay = (ms: number = 150) => new Promise((resolve) => setTimeout(resolve, ms));

// ==================== BOOKING SERVICE (mock) ====================

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

  if (!data.room_id || !data.start_at || !data.end_at) {
    const err: any = new Error('Dữ liệu đặt phòng không hợp lệ (422)');
    err.status = 422;
    throw err;
  }

  const newId = bookings.length > 0 ? Math.max(...bookings.map((b) => b.id)) + 1 : 101;
  const now = new Date().toISOString();

  const newBooking: Booking = {
    id: newId,
    room_id: data.room_id,
    room_name: data.room_name || null,
    user_id: data.user_id || 'user_admin_01',
    user_name: data.user_name || 'Demo User',
    user_email: data.user_email || 'demo@company.com',
    start_at: data.start_at,
    end_at: data.end_at,
    num_attendees: data.num_attendees || 1,
    status: 'CONFIRMED',
    checked_in_at: null,
    auto_cancelled_at: null,
    purpose: data.purpose || '',
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
      items = items.filter((item) => !item.room_id);
    } else {
      items = items.filter((item) => item.room_id === params.roomId);
    }
  }

  return items;
};

export const getEquipmentByRoom = async (roomId: number): Promise<EquipmentItem[]> => {
  await delay();
  const items = getStoredEquipment();
  return items.filter((item) => item.room_id === roomId);
};

export const createEquipment = async (
  data: Omit<EquipmentItem, 'id' | 'updated_at'>
): Promise<EquipmentItem> => {
  await delay();
  const items = getStoredEquipment();
  const newId = `EQ-${String(items.length + 1).padStart(3, '0')}`;

  const roomName = data.room_name ?? null;

  const newItem: EquipmentItem = {
    ...data,
    id: newId,
    room_name: roomName,
    updated_at: new Date().toISOString(),
  };

  items.unshift(newItem);
  saveStoredEquipment(items);

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

  let roomName = data.room_name;
  if (data.room_id !== undefined) {
    if (data.room_id === null) {
      roomName = null;
    } else {
      roomName = data.room_name ?? null;
    }
  }

  const updated: EquipmentItem = {
    ...items[index],
    ...data,
    room_name: roomName !== undefined ? roomName : items[index].room_name,
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

export const resetMockDataToDefault = (): void => {
  localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(generateInitialBookings()));
  localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(INITIAL_EQUIPMENT));
};
