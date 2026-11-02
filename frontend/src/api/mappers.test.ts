import { describe, it, expect } from 'vitest';
import { toUserRole, toAttendeeInput, toTzAwareIso } from './mappers';

describe('toUserRole()', () => {
  it('maps "Administrator" to ADMINISTRATOR', () => {
    expect(toUserRole(['Administrator'])).toBe('ADMINISTRATOR');
  });

  it('maps "Room Manager" to ROOM_MANAGER', () => {
    expect(toUserRole(['Room Manager'])).toBe('ROOM_MANAGER');
  });

  it('maps empty roles to EMPLOYEE', () => {
    expect(toUserRole([])).toBe('EMPLOYEE');
  });

  it('prefers ADMINISTRATOR when both roles present', () => {
    expect(toUserRole(['Room Manager', 'Administrator'])).toBe('ADMINISTRATOR');
  });
});

describe('toAttendeeInput()', () => {
  it('renames attendee_email to email', () => {
    const result = toAttendeeInput({ attendee_email: 'a@b.com', name: 'Alice' });
    expect(result).toEqual({ email: 'a@b.com', name: 'Alice' });
  });
});

describe('toTzAwareIso()', () => {
  it('always emits an offset', () => {
    const out = toTzAwareIso('2026-11-02T09:00:00');
    expect(out).toMatch(/(Z|[+-]\d{2}:\d{2})$/);
  });

  it('preserves the instant for a local-time input', () => {
    const input = '2026-11-02T09:00:00+07:00';
    const out = toTzAwareIso(input);
    // Both should represent the same instant in UTC
    expect(new Date(out).toISOString()).toBe(new Date(input).toISOString());
  });
});
