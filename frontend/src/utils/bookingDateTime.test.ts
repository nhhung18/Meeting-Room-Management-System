import { describe, test, expect } from 'vitest';
import dayjs from 'dayjs';
import {
  TIME_SLOTS_15MIN,
  parseAndFormatCustomTime,
  isBookingDateDisabled,
  mergeCustomTimeOptions,
} from './bookingDateTime';

describe('bookingDateTime utilities', () => {
  describe('TIME_SLOTS_15MIN', () => {
    test('contains 15-minute intervals (:00, :15, :30, :45) from 07:00 through 22:00', () => {
      expect(TIME_SLOTS_15MIN[0]).toBe('07:00');
      expect(TIME_SLOTS_15MIN).toContain('07:15');
      expect(TIME_SLOTS_15MIN).toContain('07:30');
      expect(TIME_SLOTS_15MIN).toContain('07:45');
      expect(TIME_SLOTS_15MIN).toContain('14:15');
      expect(TIME_SLOTS_15MIN).toContain('14:45');
      expect(TIME_SLOTS_15MIN[TIME_SLOTS_15MIN.length - 1]).toBe('22:00');
      expect(TIME_SLOTS_15MIN).not.toContain('22:15');
      expect(TIME_SLOTS_15MIN).toHaveLength(61);
    });
  });

  describe('parseAndFormatCustomTime', () => {
    test('normalizes single-digit hours and accepts arbitrary minutes', () => {
      expect(parseAndFormatCustomTime('9:20')).toBe('09:20');
      expect(parseAndFormatCustomTime(' 14:37 ')).toBe('14:37');
      expect(parseAndFormatCustomTime('00:05')).toBe('00:05');
      expect(parseAndFormatCustomTime('23:59')).toBe('23:59');
    });

    test('rejects invalid hours, invalid minutes, and non-time inputs', () => {
      expect(parseAndFormatCustomTime('24:00')).toBeNull();
      expect(parseAndFormatCustomTime('12:60')).toBeNull();
      expect(parseAndFormatCustomTime('09:5')).toBeNull();
      expect(parseAndFormatCustomTime('abc')).toBeNull();
      expect(parseAndFormatCustomTime('')).toBeNull();
    });
  });

  describe('mergeCustomTimeOptions', () => {
    test('prepends custom typed minute option without duplicating standard 15-min slots', () => {
      const opts = mergeCustomTimeOptions('09:22');
      expect(opts[0]).toEqual({ value: '09:22', isCustom: true });
      expect(opts.filter((o) => o.value === '09:22')).toHaveLength(1);
    });

    test('does not duplicate a standard 15-min slot when typed directly', () => {
      const opts = mergeCustomTimeOptions('09:15');
      expect(opts.filter((o) => o.value === '09:15')).toEqual([{ value: '09:15', isCustom: false }]);
    });

    test('retains selected custom value in options when search box is empty', () => {
      const opts = mergeCustomTimeOptions('', '11:42');
      expect(opts[0]).toEqual({ value: '11:42', isCustom: true });
    });
  });

  describe('isBookingDateDisabled (max 1 month limit)', () => {
    const today = dayjs('2026-11-12T10:00:00');

    test('disables past dates before today', () => {
      expect(isBookingDateDisabled(dayjs('2026-11-11'), null, today)).toBe(true);
      expect(isBookingDateDisabled(dayjs('2026-10-12'), null, today)).toBe(true);
    });

    test('allows today and dates up to exactly 1 month ahead', () => {
      expect(isBookingDateDisabled(dayjs('2026-11-12'), null, today)).toBe(false);
      expect(isBookingDateDisabled(dayjs('2026-11-30'), null, today)).toBe(false);
      expect(isBookingDateDisabled(dayjs('2026-12-12'), null, today)).toBe(false);
    });

    test('disables dates beyond 1 month from today even if policy allows more', () => {
      expect(isBookingDateDisabled(dayjs('2026-12-13'), 90, today)).toBe(true);
      expect(isBookingDateDisabled(dayjs('2027-01-01'), null, today)).toBe(true);
    });

    test('respects tighter max_advance_days policy when shorter than 1 month', () => {
      expect(isBookingDateDisabled(dayjs('2026-11-26'), 14, today)).toBe(false);
      expect(isBookingDateDisabled(dayjs('2026-11-27'), 14, today)).toBe(true);
    });
  });
});
