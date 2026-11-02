import {
  EquipmentItem,
} from '../types';
import { INITIAL_EQUIPMENT } from './mockData';

// Rooms API — calls room-service over HTTP
export * from './rooms';

// Bookings API — calls booking-service over HTTP
export * from './bookings';

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
// Simulated network delay (equipment mock only)
const delay = (ms: number = 150) => new Promise((resolve) => setTimeout(resolve, ms));

// ==================== EQUIPMENT SERVICE (mock — pending ADR) ====================

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
  localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(INITIAL_EQUIPMENT));
};
