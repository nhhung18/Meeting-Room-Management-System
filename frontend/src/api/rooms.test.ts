import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./http', () => ({
  request: vi.fn(),
}));

import { request } from './http';
import { getRooms, getRoomById, createRoom, updateRoom, deleteRoom } from './rooms';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getRooms()', () => {
  it('sends status, q, limit and offset as query params', async () => {
    vi.mocked(request).mockResolvedValueOnce({ items: [], total: 0, limit: 20, offset: 0 });
    await getRooms({ status: 'AVAILABLE', q: 'test', limit: 10, offset: 0 });
    expect(request).toHaveBeenCalledWith('/rooms/', expect.objectContaining({
      params: expect.objectContaining({ status: 'AVAILABLE', q: 'test', limit: 10, offset: 0 }),
    }));
  });

  it('filters minCapacity client-side', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      items: [
        { id: 1, capacity: 5 },
        { id: 2, capacity: 15 },
      ],
      total: 2, limit: 20, offset: 0,
    });
    const result = await getRooms({ minCapacity: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(2);
    expect(result.total).toBe(1);
  });

  it('filters equipment client-side (every match)', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      items: [
        { id: 1, equipment: ['TV', 'Camera'] },
        { id: 2, equipment: ['TV'] },
      ],
      total: 2, limit: 20, offset: 0,
    });
    const result = await getRooms({ equipment: ['Camera'] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(1);
  });

  it('omits status when it is "ALL"', async () => {
    vi.mocked(request).mockResolvedValueOnce({ items: [], total: 0, limit: 20, offset: 0 });
    await getRooms({ status: 'ALL' });
    const params = vi.mocked(request).mock.calls[0][1]?.params as Record<string, unknown>;
    expect(params?.status).toBeUndefined();
  });
});

describe('getRoomById()', () => {
  it('requests /rooms/{id}', async () => {
    vi.mocked(request).mockResolvedValueOnce({ id: 5 });
    await getRoomById(5);
    expect(request).toHaveBeenCalledWith('/rooms/5');
  });
});

describe('createRoom()', () => {
  it('POSTs to /rooms/', async () => {
    vi.mocked(request).mockResolvedValueOnce({ id: 1, name: 'New Room' });
    await createRoom({ name: 'New Room', capacity: 10 });
    expect(request).toHaveBeenCalledWith('/rooms/', expect.objectContaining({ method: 'POST' }));
  });
});

describe('updateRoom()', () => {
  it('PATCHes only the provided fields', async () => {
    vi.mocked(request).mockResolvedValueOnce({ id: 1 });
    await updateRoom(1, { capacity: 20 });
    expect(request).toHaveBeenCalledWith('/rooms/1', expect.objectContaining({
      method: 'PATCH',
      body: { capacity: 20 },
    }));
  });
});

describe('deleteRoom()', () => {
  it('DELETEs and resolves on 204', async () => {
    vi.mocked(request).mockResolvedValueOnce(undefined);
    await expect(deleteRoom(1)).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith('/rooms/1', expect.objectContaining({ method: 'DELETE' }));
  });
});
