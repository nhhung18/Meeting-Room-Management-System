import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

export const TIME_INPUT_REGEX = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;

/**
 * Generates standard booking time slots in 15-minute intervals from 07:00 to 22:00.
 */
export function generateTimeSlots15Min(): string[] {
  const slots: string[] = [];
  for (let h = 7; h <= 22; h++) {
    const hh = h.toString().padStart(2, '0');
    slots.push(`${hh}:00`);
    if (h < 22) {
      slots.push(`${hh}:15`);
      slots.push(`${hh}:30`);
      slots.push(`${hh}:45`);
    }
  }
  return slots;
}

export const TIME_SLOTS_15MIN: string[] = generateTimeSlots15Min();

/**
 * Validates and normalizes an arbitrary H:mm or HH:mm time string into zero-padded HH:mm.
 * Returns null if the input does not match a valid 24-hour clock value.
 */
export function parseAndFormatCustomTime(input: string): string | null {
  const trimmed = input.trim();
  const match = TIME_INPUT_REGEX.exec(trimmed);
  if (!match) return null;
  const [, hour, minute] = match;
  return `${hour.padStart(2, '0')}:${minute}`;
}

/**
 * Determines whether a calendar date should be disabled in the booking date picker.
 * Enforces no past dates and a strict upper bound of 1 month from the reference date (today),
 * or policies.max_advance_days if more restrictive.
 */
export function isBookingDateDisabled(
  current: Dayjs | null | undefined,
  maxAdvanceDays?: number | null,
  referenceDate: Dayjs = dayjs()
): boolean {
  if (!current) return false;
  if (current.isBefore(referenceDate.startOf('day'))) return true;

  const maxOneMonth = referenceDate.add(1, 'month').endOf('day');
  if (current.isAfter(maxOneMonth)) return true;

  if (maxAdvanceDays !== undefined && maxAdvanceDays !== null && maxAdvanceDays > 0) {
    const maxPolicy = referenceDate.add(maxAdvanceDays, 'day').endOf('day');
    if (current.isAfter(maxPolicy)) return true;
  }

  return false;
}

/**
 * Merges standard 15-minute slots with any valid custom typed or selected HH:mm value.
 */
export function mergeCustomTimeOptions(
  searchText: string,
  currentValue?: string
): Array<{ value: string; isCustom: boolean }> {
  const seen = new Set(TIME_SLOTS_15MIN);
  const customValues: string[] = [];

  const parsedSearch = parseAndFormatCustomTime(searchText);
  if (parsedSearch && !seen.has(parsedSearch)) {
    seen.add(parsedSearch);
    customValues.push(parsedSearch);
  }

  const parsedCurrent = currentValue ? parseAndFormatCustomTime(currentValue) : null;
  if (parsedCurrent && !seen.has(parsedCurrent)) {
    seen.add(parsedCurrent);
    customValues.push(parsedCurrent);
  }

  return [
    ...customValues.map((value) => ({ value, isCustom: true })),
    ...TIME_SLOTS_15MIN.map((value) => ({ value, isCustom: false })),
  ];
}
