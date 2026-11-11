import dayjs from 'dayjs';
import { request } from './http';
import { toAttendeeInput, toTzAwareIso } from './mappers';
import type { Booking, BookingFilterParams, PaginatedResponse, Attendee } from '../types';

export interface BookingWriteInput {
  room_id: number;
  start_at: string;
  end_at: string;
  num_attendees: number;
  attendees?: Pick<Attendee, 'attendee_email' | 'name'>[];
}

export async function getBookings(
  params: BookingFilterParams = {}
): Promise<PaginatedResponse<Booking>> {
  const { status, roomId, userId, startDate, endDate, q, limit, offset } = params;

  // userId, startDate, endDate, q are not supported by GET /api/bookings/ (spec B8).
  // They are applied client-side on the current page after fetch.
  const serverParams: Record<string, string | number | boolean | string[] | undefined> = {
    status: status === 'ALL' ? undefined : status,
    room_id: roomId,
    limit: limit !== undefined ? Math.min(limit, 100) : undefined,
    offset,
  };

  const page = await request<PaginatedResponse<Booking>>('/bookings/', { params: serverParams });

  let items = page.items;

  if (userId) {
    items = items.filter((b) => b.user_id === userId);
  }
  if (startDate) {
    items = items.filter((b) => !dayjs(b.start_at).isBefore(dayjs(startDate), 'day'));
  }
  if (endDate) {
    items = items.filter((b) => !dayjs(b.end_at).isAfter(dayjs(endDate), 'day'));
  }
  if (q) {
    const ql = q.toLowerCase();
    items = items.filter(
      (b) =>
        (b.room_name && b.room_name.toLowerCase().includes(ql)) ||
        (b.user_name && b.user_name.toLowerCase().includes(ql)) ||
        b.attendees.some(
          (a) => a.name.toLowerCase().includes(ql) || a.attendee_email.toLowerCase().includes(ql)
        )
    );
  }

  return { ...page, items, total: items.length };
}

export async function getBookingById(id: number): Promise<Booking> {
  return request<Booking>(`/bookings/${id}`);
}

export async function createBooking(data: BookingWriteInput): Promise<Booking> {
  const body = {
    room_id: data.room_id,
    start_at: toTzAwareIso(data.start_at),
    end_at: toTzAwareIso(data.end_at),
    num_attendees: data.num_attendees,
    attendees: (data.attendees ?? []).map(toAttendeeInput),
  };
  return request<Booking>('/bookings/', { method: 'POST', body });
}

export async function updateBooking(
  id: number,
  data: Partial<BookingWriteInput>
): Promise<Booking> {
  const body: Record<string, unknown> = { ...data };
  if (data.start_at) body.start_at = toTzAwareIso(data.start_at);
  if (data.end_at) body.end_at = toTzAwareIso(data.end_at);
  if (data.attendees) body.attendees = data.attendees.map(toAttendeeInput);
  return request<Booking>(`/bookings/${id}`, { method: 'PATCH', body });
}

export async function cancelBooking(id: number): Promise<Booking> {
  return request<Booking>(`/bookings/${id}/cancel`, { method: 'POST' });
}

export async function checkInBooking(id: number): Promise<Booking> {
  return request<Booking>(`/bookings/${id}/check-in`, { method: 'POST' });
}

// Check-in window: ±15 minutes from start_at (configurable in a future booking_policies table)
export function isCheckInEligible(startAt: string): boolean {
  const diffMinutes = Math.abs(dayjs().diff(dayjs(startAt), 'minute'));
  return diffMinutes <= 15;
}
