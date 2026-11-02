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
});
