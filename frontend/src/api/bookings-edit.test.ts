import { describe, test, expect, vi, beforeEach } from 'vitest';
import { updateBooking } from './bookings';
import * as http from './http';

vi.mock('./http', () => ({
  request: vi.fn(),
}));

const mockRequest = vi.mocked(http.request);

describe('updateBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('sends PATCH with only changed fields', async () => {
    const updated = { id: 1, room_id: 1, num_attendees: 5, status: 'CONFIRMED' };
    mockRequest.mockResolvedValue(updated);

    const result = await updateBooking(1, { num_attendees: 5 });

    expect(mockRequest).toHaveBeenCalledWith('/bookings/1', {
      method: 'PATCH',
      body: { num_attendees: 5 },
    });
    expect(result).toEqual(updated);
  });

  test('sends attendees through toAttendeeInput mapper', async () => {
    const updated = { id: 1, status: 'CONFIRMED' };
    mockRequest.mockResolvedValue(updated);

    await updateBooking(1, {
      attendees: [{ attendee_email: 'a@b.com', name: 'A' }],
    });

    const call = mockRequest.mock.calls[0];
    const body = call[1]?.body as Record<string, unknown>;
    expect(body.attendees).toEqual([{ email: 'a@b.com', name: 'A' }]);
  });

  test('sends timezone-aware datetimes (Z suffix) via toTzAwareIso', async () => {
    const updated = { id: 1, status: 'CONFIRMED' };
    mockRequest.mockResolvedValue(updated);

    await updateBooking(1, {
      start_at: '2026-12-01T08:00:00+07:00',
      end_at: '2026-12-01T09:00:00+07:00',
    });

    const call = mockRequest.mock.calls[0];
    const body = call[1]?.body as Record<string, unknown>;
    expect(typeof body.start_at).toBe('string');
    expect((body.start_at as string).endsWith('Z')).toBe(true);
    expect((body.end_at as string).endsWith('Z')).toBe(true);
  });

  test('surfaces ApiError 409 for conflict unchanged', async () => {
    const conflictErr = Object.assign(new Error('Phòng đã được đặt'), { status: 409, detail: 'Phòng đã được đặt' });
    mockRequest.mockRejectedValue(conflictErr);

    await expect(updateBooking(1, { num_attendees: 3 })).rejects.toMatchObject({
      status: 409,
      detail: 'Phòng đã được đặt',
    });
  });

  test('surfaces ApiError 409 for invalid booking state unchanged', async () => {
    const stateErr = Object.assign(new Error('InvalidStateError'), { status: 409, detail: 'InvalidStateError' });
    mockRequest.mockRejectedValue(stateErr);

    await expect(updateBooking(1, { num_attendees: 2 })).rejects.toMatchObject({
      status: 409,
    });
  });
});
