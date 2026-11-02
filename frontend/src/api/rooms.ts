import { request } from './http';
import type { Room, RoomStatus, RoomFilterParams, PaginatedResponse } from '../types';

export interface RoomWriteInput {
  name: string;
  capacity: number;
  status?: RoomStatus;
  equipment?: string[];
  owner_id?: string | null;
  floor?: string;
  description?: string;
}

export async function getRooms(
  params: RoomFilterParams = {}
): Promise<PaginatedResponse<Room>> {
  const { minCapacity, equipment, status, ...rest } = params;

  // minCapacity and equipment are not yet supported by GET /api/rooms/
  // (spec B7 — backend gap P0-4). Filter on the result set after fetch.
  const serverParams: Record<string, string | number | boolean | string[] | undefined> = {
    ...rest,
    status: status === 'ALL' ? undefined : status,
  };

  const page = await request<PaginatedResponse<Room>>('/rooms/', { params: serverParams });

  let items = page.items;

  if (minCapacity && minCapacity > 0) {
    items = items.filter((r) => r.capacity >= minCapacity);
  }

  if (equipment && equipment.length > 0) {
    items = items.filter((r) =>
      equipment.every((needed) =>
        r.equipment.some((eq) => eq.toLowerCase().includes(needed.toLowerCase()))
      )
    );
  }

  return { ...page, items, total: items.length };
}

export async function getRoomById(id: number): Promise<Room> {
  return request<Room>(`/rooms/${id}`);
}

export async function createRoom(data: RoomWriteInput): Promise<Room> {
  return request<Room>('/rooms/', { method: 'POST', body: data });
}

export async function updateRoom(id: number, data: Partial<RoomWriteInput>): Promise<Room> {
  return request<Room>(`/rooms/${id}`, { method: 'PATCH', body: data });
}

export async function deleteRoom(id: number): Promise<void> {
  return request<void>(`/rooms/${id}`, { method: 'DELETE' });
}
