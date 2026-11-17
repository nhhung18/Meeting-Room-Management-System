import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./http', () => ({
  request: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, detail: string) {
      super(detail);
      this.status = status;
      this.detail = detail;
    }
  },
}));

import { request, ApiError } from './http';
import {
  getBookings,
  getBookingById,
  createBooking,
  updateBooking,
  cancelBooking,
  checkInBooking,
  isCheckInEligible,
} from './bookings';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getBookings()', () => {
  it('sends room_id, status, limit and offset', async () => {
    vi.mocked(request).mockResolvedValueOnce({ items: [], total: 0, limit: 20, offset: 0 });
    await getBookings({ roomId: 3, status: 'CONFIRMED', limit: 20, offset: 0 });
    expect(request).toHaveBeenCalledWith('/bookings/', expect.objectContaining({
      params: expect.objectContaining({ room_id: 3, status: 'CONFIRMED', limit: 20, offset: 0 }),
    }));
  });

  it('clamps limit to 100', async () => {
    vi.mocked(request).mockResolvedValueOnce({ items: [], total: 0, limit: 100, offset: 0 });
    await getBookings({ limit: 9999 });
    const params = vi.mocked(request).mock.calls[0][1]?.params as Record<string, unknown>;
    expect(params?.limit).toBe(100);
  });
});

describe('createBooking()', () => {
  it('renames attendees to {email, name}', async () => {
    vi.mocked(request).mockResolvedValueOnce({ id: 1 });
    await createBooking({
      room_id: 1,
      start_at: '2026-11-03T09:00:00Z',
      end_at: '2026-11-03T10:00:00Z',
      num_attendees: 2,
      attendees: [{ attendee_email: 'a@b.com', name: 'Alice' }],
    });
    const body = vi.mocked(request).mock.calls[0][1]?.body as any;
    expect(body.attendees[0]).toEqual({ email: 'a@b.com', name: 'Alice' });
  });

  it('sends timezone-aware start_at and end_at', async () => {
    vi.mocked(request).mockResolvedValueOnce({ id: 1 });
    await createBooking({
      room_id: 1,
      start_at: '2026-11-03T09:00:00',
      end_at: '2026-11-03T10:00:00',
      num_attendees: 1,
    });
    const body = vi.mocked(request).mock.calls[0][1]?.body as any;
    expect(body.start_at).toMatch(/(Z|[+-]\d{2}:\d{2})$/);
    expect(body.end_at).toMatch(/(Z|[+-]\d{2}:\d{2})$/);
  });

  it('surfaces ApiError 409 unchanged', async () => {
    vi.mocked(request).mockRejectedValueOnce(new ApiError(409, 'Phòng đã được đặt'));
    await expect(
      createBooking({ room_id: 1, start_at: '2026-11-03T09:00:00Z', end_at: '2026-11-03T10:00:00Z', num_attendees: 1 })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('surfaces ApiError 422 unchanged', async () => {
    vi.mocked(request).mockRejectedValueOnce(new ApiError(422, 'Vượt sức chứa'));
    await expect(
      createBooking({ room_id: 1, start_at: '2026-11-03T09:00:00Z', end_at: '2026-11-03T10:00:00Z', num_attendees: 1 })
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe('updateBooking()', () => {
  it('PATCHes /bookings/{id} with only provided fields', async () => {
    vi.mocked(request).mockResolvedValueOnce({ id: 5 });
    await updateBooking(5, { num_attendees: 4 });
    expect(request).toHaveBeenCalledWith('/bookings/5', expect.objectContaining({
      method: 'PATCH',
      body: expect.objectContaining({ num_attendees: 4 }),
    }));
  });
});

describe('cancelBooking()', () => {
  it('POSTs /bookings/{id}/cancel', async () => {
    vi.mocked(request).mockResolvedValueOnce({ id: 5, status: 'CANCELLED' });
    await cancelBooking(5);
    expect(request).toHaveBeenCalledWith('/bookings/5/cancel', expect.objectContaining({ method: 'POST' }));
  });
});

describe('checkInBooking()', () => {
  it('POSTs /bookings/{id}/check-in', async () => {
    vi.mocked(request).mockResolvedValueOnce({ id: 5, status: 'CHECKED_IN' });
    await checkInBooking(5);
    expect(request).toHaveBeenCalledWith('/bookings/5/check-in', expect.objectContaining({ method: 'POST' }));
  });
});

describe('isCheckInEligible()', () => {
  it('is true 10 minutes before start', () => {
    const start = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    expect(isCheckInEligible(start)).toBe(true);
  });

  it('is false 30 minutes before start', () => {
    const start = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    expect(isCheckInEligible(start)).toBe(false);
  });
});
