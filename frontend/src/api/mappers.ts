import dayjs from 'dayjs';
import type { UserRole, Attendee } from '../types';

// JWT role names from Auth0 → frontend enum
// Backend uses "Administrator" and "Room Manager" (with space), not SNAKE_CASE
export function toUserRole(roles: string[]): UserRole {
  if (roles.includes('Administrator')) return 'ADMINISTRATOR';
  if (roles.includes('Room Manager')) return 'ROOM_MANAGER';
  return 'EMPLOYEE';
}

// Backend BookingCreate expects {email, name}; response has {attendee_email, name}
export function toAttendeeInput(
  a: Pick<Attendee, 'attendee_email' | 'name'>
): { email: string; name: string } {
  return { email: a.attendee_email, name: a.name };
}

// Always produce an ISO string with timezone offset (never naive)
// dayjs().toISOString() always returns UTC with "Z" suffix
export function toTzAwareIso(value: string | Date | ReturnType<typeof dayjs>): string {
  return dayjs(value).toISOString();
}
