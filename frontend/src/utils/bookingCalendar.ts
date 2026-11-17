import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import type { Booking } from '../types';

export type CalendarViewMode = 'day' | 'week' | 'month' | 'year';

export interface CalendarDayColumn {
  date: dayjs.Dayjs;
  dateStr: string;
  dayName: string;
  fullDayName: string;
  dayNumber: string;
  formatted: string;
  isToday: boolean;
}

export interface MonthDayCell {
  date: dayjs.Dayjs;
  dateStr: string;
  dayNumber: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayBookings: Booking[];
}

export interface YearMonthOverview {
  monthIndex: number;
  monthName: string;
  monthDate: dayjs.Dayjs;
  isCurrentMonth: boolean;
  totalBookings: number;
}

/** Standard conference timetable hours displayed in Day & Week grids (07:00 - 22:00). */
export const CALENDAR_HOURS = [
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
];

/** Returns Sunday start of week matching the Google Calendar timetable grid. */
export function getWeekStartSunday(date: dayjs.Dayjs): dayjs.Dayjs {
  return date.subtract(date.day(), 'day').startOf('day');
}

/** Builds 7 sequential day column descriptors starting from weekStart (Sunday -> Saturday). */
export function buildWeekDays(
  weekStart: dayjs.Dayjs,
  language: 'vi' | 'en',
  today: dayjs.Dayjs = dayjs()
): CalendarDayColumn[] {
  const dayNames =
    language === 'vi'
      ? ['CN', 'TH 2', 'TH 3', 'TH 4', 'TH 5', 'TH 6', 'TH 7']
      : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const fullDayNames =
    language === 'vi'
      ? ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']
      : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return Array.from({ length: 7 }).map((_, idx) => {
    const date = weekStart.add(idx, 'day');
    const dIndex = date.day();
    return {
      date,
      dateStr: date.format('YYYY-MM-DD'),
      dayName: dayNames[dIndex],
      fullDayName: fullDayNames[dIndex],
      dayNumber: date.format('D'),
      formatted: date.format('DD/MM'),
      isToday: date.isSame(today, 'day'),
    };
  });
}

const STEP_UNIT_MAP: Record<CalendarViewMode, dayjs.ManipulateType> = {
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
};

/** Steps anchor date backward (-1) or forward (1) by the active calendar view unit. */
export function stepCalendarDate(
  currentDate: dayjs.Dayjs,
  mode: CalendarViewMode,
  direction: -1 | 1
): dayjs.Dayjs {
  const unit = STEP_UNIT_MAP[mode];
  return direction === 1 ? currentDate.add(1, unit) : currentDate.subtract(1, unit);
}

/** Formats the top bar title label according to view mode and active UI language. */
export function formatCalendarHeaderLabel(
  currentDate: dayjs.Dayjs,
  mode: CalendarViewMode,
  language: 'vi' | 'en'
): string {
  const locale = language === 'vi' ? 'vi' : 'en';
  if (mode === 'day') {
    return currentDate
      .locale(locale)
      .format(language === 'vi' ? 'dddd, DD/MM/YYYY' : 'dddd, MMM D, YYYY');
  }
  if (mode === 'week') {
    return getWeekStartSunday(currentDate)
      .add(3, 'day')
      .locale(locale)
      .format(language === 'vi' ? '[Tháng] M, YYYY' : 'MMMM YYYY');
  }
  if (mode === 'month') {
    return currentDate
      .locale(locale)
      .format(language === 'vi' ? '[Tháng] M, YYYY' : 'MMMM YYYY');
  }
  return currentDate.format(language === 'vi' ? '[Năm] YYYY' : 'YYYY');
}

/** Checks whether a booking overlaps the 1-hour slot [hourNum:00, hourNum+1:00) on dateStr. */
export function bookingOverlapsHour(
  b: Booking,
  dateStr: string,
  hourNum: number
): boolean {
  const bDate = dayjs(b.start_at).format('YYYY-MM-DD');
  if (bDate !== dateStr) return false;
  const start = dayjs(b.start_at);
  const end = dayjs(b.end_at);
  const bStartHour = start.hour();
  const effectiveEndHour = end.minute() > 0 ? end.hour() + 1 : end.hour();
  return hourNum >= bStartHour && hourNum < Math.max(bStartHour + 1, effectiveEndHour);
}

/** Returns sorted HH:00 labels (00:00 - 23:00) that have at least one overlapping booking on dateStr. */
export function getActiveHoursForDate(bookings: Booking[], dateStr: string): string[] {
  const dayBookings = filterBookingsInRange(bookings, dateStr, dateStr);
  if (dayBookings.length === 0) return [];

  const activeHours: string[] = [];
  for (let h = 0; h < 24; h++) {
    if (dayBookings.some((b) => bookingOverlapsHour(b, dateStr, h))) {
      activeHours.push(`${String(h).padStart(2, '0')}:00`);
    }
  }
  return activeHours;
}

/** Filters bookings whose start date falls within [startStr, endStr] inclusive (YYYY-MM-DD).
 *  CANCELLED bookings are always excluded — they should not appear on the calendar. */
export function filterBookingsInRange(
  bookings: Booking[],
  startStr: string,
  endStr: string
): Booking[] {
  return bookings.filter((b) => {
    if (b.status === 'CANCELLED') return false;
    const bDate = dayjs(b.start_at).format('YYYY-MM-DD');
    return bDate >= startStr && bDate <= endStr;
  });
}

/** Builds Sunday-to-Saturday grid cells covering the month of currentDate. */
export function buildMonthCalendarDays(
  currentDate: dayjs.Dayjs,
  bookings: Booking[],
  today: dayjs.Dayjs = dayjs()
): MonthDayCell[] {
  const startOfMonth = currentDate.startOf('month');
  const endOfMonth = currentDate.endOf('month');
  const gridStart = startOfMonth.subtract(startOfMonth.day(), 'day');
  const gridEnd = endOfMonth.add(6 - endOfMonth.day(), 'day');

  const days: MonthDayCell[] = [];
  let cur = gridStart;
  while (cur.isBefore(gridEnd) || cur.isSame(gridEnd, 'day')) {
    const dateStr = cur.format('YYYY-MM-DD');
    days.push({
      date: cur,
      dateStr,
      dayNumber: cur.format('D'),
      isCurrentMonth: cur.month() === currentDate.month(),
      isToday: cur.isSame(today, 'day'),
      dayBookings: bookings.filter(
        (b) => b.status !== 'CANCELLED' && dayjs(b.start_at).format('YYYY-MM-DD') === dateStr
      ),
    });
    cur = cur.add(1, 'day');
  }
  return days;
}

/** Builds the 12-month overview cards for the year of currentDate. */
export function buildYearMonths(
  currentDate: dayjs.Dayjs,
  bookings: Booking[],
  language: 'vi' | 'en',
  today: dayjs.Dayjs = dayjs()
): YearMonthOverview[] {
  const year = currentDate.year();
  const locale = language === 'vi' ? 'vi' : 'en';
  const months: YearMonthOverview[] = [];

  for (let m = 0; m < 12; m++) {
    const monthDate = dayjs().year(year).month(m).startOf('month');
    const startStr = monthDate.format('YYYY-MM-DD');
    const endStr = monthDate.endOf('month').format('YYYY-MM-DD');
    const monthBookings = filterBookingsInRange(bookings, startStr, endStr);

    months.push({
      monthIndex: m,
      monthName:
        language === 'vi'
          ? `Tháng ${m + 1}`
          : monthDate.locale(locale).format('MMMM'),
      monthDate,
      isCurrentMonth: today.year() === year && today.month() === m,
      totalBookings: monthBookings.length,
    });
  }
  return months;
}

/** Returns card badge styling aligned with status and theme contrast. */
export function getEventBadgeStyle(
  b: Booking,
  isDark: boolean
): { bg: string; dot: string } {
  if (b.status === 'CHECKED_IN') {
    return {
      bg: isDark
        ? 'bg-[#30d158]/20 border-[#30d158]/40 text-emerald-200'
        : 'bg-[#10b981] border-[#059669] text-white',
      dot: 'bg-emerald-300',
    };
  }
  const palettes = [
    {
      bg: isDark
        ? 'bg-[#0a84ff]/25 border-[#0a84ff]/40 text-blue-100'
        : 'bg-[#1e40af] border-[#1d4ed8] text-white',
      dot: 'bg-sky-300',
    },
    {
      bg: isDark
        ? 'bg-[#bf5af2]/25 border-[#bf5af2]/40 text-purple-100'
        : 'bg-[#7c3aed] border-[#6d28d9] text-white',
      dot: 'bg-purple-300',
    },
    {
      bg: isDark
        ? 'bg-[#ff9f0a]/25 border-[#ff9f0a]/40 text-amber-100'
        : 'bg-[#ea580c] border-[#c2410c] text-white',
      dot: 'bg-amber-300',
    },
    {
      bg: isDark
        ? 'bg-[#64d2ff]/25 border-[#64d2ff]/40 text-cyan-100'
        : 'bg-[#0284c7] border-[#0369a1] text-white',
      dot: 'bg-cyan-300',
    },
  ];
  return palettes[b.id % palettes.length];
}
