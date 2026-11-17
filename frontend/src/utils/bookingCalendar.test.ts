import { describe, test, expect } from 'vitest';
import dayjs from 'dayjs';
import {
  CALENDAR_HOURS,
  getWeekStartSunday,
  buildWeekDays,
  stepCalendarDate,
  formatCalendarHeaderLabel,
  bookingOverlapsHour,
  getActiveHoursForDate,
  filterBookingsInRange,
  getEventBadgeStyle,
} from './bookingCalendar';
import type { Booking } from '../types';

const makeBooking = (overrides: Partial<Booking> = {}): Booking => ({
  id: 4,
  room_id: 1,
  user_id: 'u1',
  start_at: '2026-11-12T09:15:00+07:00',
  end_at: '2026-11-12T10:45:00+07:00',
  num_attendees: 4,
  status: 'CONFIRMED',
  checked_in_at: null,
  auto_cancelled_at: null,
  created_at: '2026-11-10T08:00:00Z',
  updated_at: '2026-11-10T08:00:00Z',
  room_name: 'Orion',
  attendees: [],
  purpose: 'Sprint Sync',
  ...overrides,
});

describe('bookingCalendar helpers', () => {
  test('CALENDAR_HOURS covers 07:00 to 22:00', () => {
    expect(CALENDAR_HOURS[0]).toBe('07:00');
    expect(CALENDAR_HOURS[CALENDAR_HOURS.length - 1]).toBe('22:00');
    expect(CALENDAR_HOURS).toHaveLength(16);
  });

  test('getWeekStartSunday anchors to Sunday', () => {
    const thu = dayjs('2026-11-12'); // Thursday
    const sun = getWeekStartSunday(thu);
    expect(sun.day()).toBe(0);
    expect(sun.format('YYYY-MM-DD')).toBe('2026-11-08');
  });

  test('buildWeekDays returns 7 columns with fullDayName and today highlight', () => {
    const today = dayjs('2026-11-12');
    const weekStart = getWeekStartSunday(today);
    const cols = buildWeekDays(weekStart, 'vi', today);
    expect(cols).toHaveLength(7);
    expect(cols[0].dayName).toBe('CN');
    expect(cols[4].dateStr).toBe('2026-11-12');
    expect(cols[4].fullDayName).toBe('Thứ năm');
    expect(cols[4].isToday).toBe(true);
    expect(cols[3].isToday).toBe(false);
  });

  test('stepCalendarDate advances/rewinds according to view mode', () => {
    const anchor = dayjs('2026-11-12');
    expect(stepCalendarDate(anchor, 'day', 1).format('YYYY-MM-DD')).toBe('2026-11-13');
    expect(stepCalendarDate(anchor, 'day', -1).format('YYYY-MM-DD')).toBe('2026-11-11');
    expect(stepCalendarDate(anchor, 'week', 1).format('YYYY-MM-DD')).toBe('2026-11-19');
    expect(stepCalendarDate(anchor, 'month', -1).format('YYYY-MM-DD')).toBe('2026-10-12');
    expect(stepCalendarDate(anchor, 'year', 1).format('YYYY-MM-DD')).toBe('2027-11-12');
  });

  test('formatCalendarHeaderLabel formats day view in vi and en', () => {
    const anchor = dayjs('2026-11-12');
    expect(formatCalendarHeaderLabel(anchor, 'day', 'vi')).toContain('12/11/2026');
    expect(formatCalendarHeaderLabel(anchor, 'day', 'en')).toContain('Nov 12, 2026');
    expect(formatCalendarHeaderLabel(anchor, 'year', 'vi')).toBe('Năm 2026');
  });

  test('bookingOverlapsHour handles custom minute end bounds (:15 and :45)', () => {
    const b = makeBooking({
      start_at: '2026-11-12T09:15:00',
      end_at: '2026-11-12T10:45:00',
    });
    expect(bookingOverlapsHour(b, '2026-11-12', 8)).toBe(false);
    expect(bookingOverlapsHour(b, '2026-11-12', 9)).toBe(true);
    expect(bookingOverlapsHour(b, '2026-11-12', 10)).toBe(true);
    expect(bookingOverlapsHour(b, '2026-11-12', 11)).toBe(false);
    expect(bookingOverlapsHour(b, '2026-11-13', 9)).toBe(false);
  });

  test('filterBookingsInRange selects inclusive date window', () => {
    const b1 = makeBooking({ id: 1, start_at: '2026-11-08T09:00:00' });
    const b2 = makeBooking({ id: 2, start_at: '2026-11-15T09:00:00' });
    expect(filterBookingsInRange([b1, b2], '2026-11-08', '2026-11-14').map((b) => b.id)).toEqual([1]);
  });

  test('getEventBadgeStyle uses #1e40af in light mode for confirmed primary palette and #0a84ff in dark mode', () => {
    const b = makeBooking({ id: 4, status: 'CONFIRMED' });
    expect(getEventBadgeStyle(b, false).bg).toContain('bg-[#1e40af]');
    expect(getEventBadgeStyle(b, true).bg).toContain('bg-[#0a84ff]');
  });

  test('getActiveHoursForDate returns only occupied hours in chronological order and [] for empty dates', () => {
    const morning = makeBooking({
      id: 10,
      start_at: '2026-11-12T09:15:00+07:00',
      end_at: '2026-11-12T10:45:00+07:00',
    });
    const evening = makeBooking({
      id: 11,
      start_at: '2026-11-12T23:00:00+07:00',
      end_at: '2026-11-12T23:30:00+07:00',
    });
    const otherDay = makeBooking({
      id: 12,
      start_at: '2026-11-13T14:00:00+07:00',
      end_at: '2026-11-13T15:00:00+07:00',
    });

    expect(getActiveHoursForDate([morning, evening, otherDay], '2026-11-12')).toEqual([
      '09:00',
      '10:00',
      '23:00',
    ]);
    expect(getActiveHoursForDate([morning, evening, otherDay], '2026-11-14')).toEqual([]);
  });
});
