import React, { useMemo } from 'react';
import { Button, Empty, Modal, Spin, Tag } from 'antd';
import {
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Booking, BOOKING_STATUS_CONFIG, getBookingStatusLabel } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import {
  CALENDAR_HOURS,
  CalendarViewMode,
  bookingOverlapsHour,
  buildMonthCalendarDays,
  buildWeekDays,
  buildYearMonths,
  filterBookingsInRange,
  formatCalendarHeaderLabel,
  getActiveHoursForDate,
  getEventBadgeStyle,
  getWeekStartSunday,
  stepCalendarDate,
} from '../utils/bookingCalendar';

export interface BookingCalendarProps {
  bookings: Booking[];
  currentDate: dayjs.Dayjs;
  onCurrentDateChange: (date: dayjs.Dayjs) => void;
  viewMode?: CalendarViewMode;
  showViewModeSelector?: boolean;
  onViewModeChange?: (mode: CalendarViewMode) => void;
  onBookingClick: (booking: Booking, e: React.MouseEvent) => void;
  showRoomName?: boolean;
  hideEmptyHours?: boolean;
  showDayHeader?: boolean;
  loading?: boolean;
}

/**
 * Shared Google Calendar schedule viewer supporting Day, Week, Month, and Year layouts.
 * Read-only on empty slots; clicking existing events triggers onBookingClick.
 */
export const BookingCalendar: React.FC<BookingCalendarProps> = ({
  bookings,
  currentDate,
  onCurrentDateChange,
  viewMode = 'week',
  showViewModeSelector = true,
  onViewModeChange,
  onBookingClick,
  showRoomName = false,
  hideEmptyHours = false,
  showDayHeader = true,
  loading = false,
}) => {
  const { isDark } = useTheme();
  const { t, language } = useLanguage();

  const currentWeekStart = useMemo(() => getWeekStartSunday(currentDate), [currentDate]);
  const selectedDayStr = useMemo(() => currentDate.format('YYYY-MM-DD'), [currentDate]);

  const weekDays = useMemo(
    () => buildWeekDays(currentWeekStart, language),
    [currentWeekStart, language]
  );

  const weekBookings = useMemo(() => {
    const startStr = currentWeekStart.format('YYYY-MM-DD');
    const endStr = currentWeekStart.add(6, 'day').format('YYYY-MM-DD');
    return filterBookingsInRange(bookings, startStr, endStr);
  }, [bookings, currentWeekStart]);

  const currentHeaderLabel = useMemo(
    () => formatCalendarHeaderLabel(currentDate, viewMode, language),
    [currentDate, viewMode, language]
  );

  const monthCalendarDays = useMemo(
    () => (viewMode === 'month' ? buildMonthCalendarDays(currentDate, bookings) : []),
    [viewMode, currentDate, bookings]
  );

  const yearMonths = useMemo(
    () => (viewMode === 'year' ? buildYearMonths(currentDate, bookings, language) : []),
    [viewMode, currentDate, bookings, language]
  );

  const now = dayjs();
  const currentHour = now.hour();
  const currentMinute = now.minute();

  const isWeekView = viewMode === 'week';
  const showActiveHoursOnly = !isWeekView && hideEmptyHours;
  const displayedHours = useMemo(
    () =>
      showActiveHoursOnly
        ? getActiveHoursForDate(weekBookings, selectedDayStr)
        : CALENDAR_HOURS,
    [showActiveHoursOnly, weekBookings, selectedDayStr]
  );
  const gridDays = isWeekView
    ? weekDays
    : weekDays.filter((d) => d.dateStr === selectedDayStr);
  const gridTemplateCols = isWeekView
    ? 'grid-cols-[64px_repeat(7,1fr)]'
    : 'grid-cols-[64px_1fr]';

  const prevLabel =
    viewMode === 'day'
      ? language === 'vi'
        ? 'Ngày trước'
        : 'Previous Day'
      : t.calendarPrevWeek;
  const nextLabel =
    viewMode === 'day'
      ? language === 'vi'
        ? 'Ngày tiếp theo'
        : 'Next Day'
      : t.calendarNextWeek;

  return (
    <div
      className={`rounded-2xl border transition-colors overflow-hidden ${
        isDark
          ? 'bg-[#1c1c1e] border-white/15 text-white'
          : 'bg-white border-slate-200 text-slate-800'
      }`}
    >
      {/* Google Calendar Style Top Control Bar */}
      <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-white/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Left: Today, Prev/Next Arrows, Dynamic Date Title */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => onCurrentDateChange(dayjs().startOf('day'))}
            className={`px-3.5 py-1.5 rounded-full border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              isDark
                ? 'border-white/15 bg-white/5 hover:bg-white/10 text-white'
                : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700 shadow-2xs'
            }`}
          >
            {t.calendarToday}
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onCurrentDateChange(stepCalendarDate(currentDate, viewMode, -1))}
              aria-label={prevLabel}
              className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                isDark
                  ? 'border-white/15 hover:bg-white/10 text-white'
                  : 'border-transparent hover:bg-slate-100 text-slate-600'
              }`}
            >
              <LeftOutlined style={{ fontSize: 13 }} />
            </button>
            <button
              type="button"
              onClick={() => onCurrentDateChange(stepCalendarDate(currentDate, viewMode, 1))}
              aria-label={nextLabel}
              className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                isDark
                  ? 'border-white/15 hover:bg-white/10 text-white'
                  : 'border-transparent hover:bg-slate-100 text-slate-600'
              }`}
            >
              <RightOutlined style={{ fontSize: 13 }} />
            </button>
          </div>

          <span className="font-bold text-base sm:text-lg text-slate-800 dark:text-white tracking-tight ml-1 capitalize">
            {currentHeaderLabel}
          </span>
        </div>

        {/* Right: Optional 4-View Mode Switcher (Day, Week, Month, Year) */}
        {showViewModeSelector && onViewModeChange && (
          <div className="flex items-center justify-end w-full sm:w-auto">
            <div
              role="group"
              aria-label="Calendar view mode"
              className={`inline-flex flex-wrap p-1 rounded-xl border ${
                isDark ? 'bg-[#18181a] border-white/10' : 'bg-slate-100/90 border-slate-200'
              }`}
            >
              {(
                [
                  { key: 'day', label: t.calendarDayView },
                  { key: 'week', label: t.calendarWeekView },
                  { key: 'month', label: t.calendarMonthView },
                  { key: 'year', label: t.calendarYearView },
                ] as const
              ).map((opt) => {
                const isActive = viewMode === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => onViewModeChange(opt.key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      isActive
                        ? isDark
                          ? 'bg-[#0a84ff] text-white shadow-xs'
                          : 'bg-[#1e40af] text-white shadow-xs'
                        : isDark
                        ? 'text-zinc-400 hover:text-white hover:bg-white/5'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 bg-slate-50/70 dark:bg-[#242426] border-b border-slate-200 dark:border-white/15 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-zinc-300 gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full inline-block ${
                isDark ? 'bg-[#0a84ff]' : 'bg-[#1e40af]'
              }`}
            />
            <span>{t.statusConfirmed}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#30d158] inline-block" />
            <span>{t.statusCheckedIn}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-500 inline-block" />
            <span>{t.statusCancelled}</span>
          </span>
        </div>
        <span className="text-[11px] text-slate-400 italic">{t.calendarReadOnlyHint}</span>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Spin description={t.loadingRooms} />
        </div>
      ) : viewMode === 'week' || viewMode === 'day' ? (
        /* GOOGLE CALENDAR TIMEGRID (WEEK & DAY VIEWS) */
        <div className="overflow-x-auto">
          <div className={isWeekView ? 'min-w-[760px]' : 'w-full'}>
            {/* Day Headers */}
            {showDayHeader && (
              <div
                className={`grid ${gridTemplateCols} border-b border-slate-200 dark:border-white/15 bg-white dark:bg-[#1c1c1e] sticky top-0 z-10`}
              >
                <div className="p-2.5 text-center flex flex-col items-center justify-center border-r border-slate-200 dark:border-white/15">
                  <span className="text-[10px] font-mono text-slate-400 font-semibold tracking-wider">
                    GMT+7
                  </span>
                </div>

              {gridDays.map((day) => (
                <div
                  key={day.dateStr}
                  className={`py-2 px-1 text-center border-r border-slate-200 dark:border-white/15 last:border-r-0 ${
                    day.isToday ? 'bg-blue-50/30 dark:bg-white/5' : ''
                  }`}
                >
                  <div
                    className={`text-[11px] uppercase font-bold tracking-wider mb-1 ${
                      day.isToday
                        ? isDark
                          ? 'text-[#0a84ff]'
                          : 'text-[#1e40af]'
                        : 'text-slate-500 dark:text-zinc-400'
                    }`}
                  >
                    {isWeekView ? day.dayName : day.fullDayName}
                  </div>
                  {day.isToday ? (
                    <div
                      className={`w-9 h-9 rounded-full text-white flex items-center justify-center font-bold text-base shadow-sm mx-auto ${
                        isDark ? 'bg-[#0a84ff]' : 'bg-[#1e40af]'
                      }`}
                    >
                      {day.dayNumber}
                    </div>
                  ) : (
                    <div className="w-9 h-9 flex items-center justify-center font-bold text-base text-slate-700 dark:text-zinc-200 mx-auto">
                      {day.dayNumber}
                    </div>
                  )}
                </div>
              ))}
            </div>
            )}

            {/* Timetable Body (all slots 07:00-22:00, or active-only hours when hideEmptyHours is enabled) */}
            <div className="relative">
              {showActiveHoursOnly && displayedHours.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <span className="text-sm text-slate-500 dark:text-zinc-400">
                        {`${t.noMeetingsOnDate} ${currentDate.format('DD/MM/YYYY')}`}
                      </span>
                    }
                  />
                </div>
              ) : (
                displayedHours.map((hour) => {
                  const hourNum = parseInt(hour.split(':')[0], 10);
                  const isCurrentHourRow = hourNum === currentHour;

                  return (
                    <div
                      key={hour}
                      className={`grid ${gridTemplateCols} border-b border-slate-100 dark:border-white/5 min-h-[58px]`}
                    >
                      <div
                        className={`text-right pr-3 text-[11px] font-mono select-none border-r border-slate-200 dark:border-white/10 bg-white dark:bg-[#1c1c1e] ${
                          showActiveHoursOnly
                            ? 'pt-2.5 font-semibold text-slate-500 dark:text-zinc-400'
                            : '-mt-2.5 text-slate-400'
                        }`}
                      >
                        {hour}
                      </div>

                    {gridDays.map((day) => {
                      const slotBookings = weekBookings.filter((b) =>
                        bookingOverlapsHour(b, day.dateStr, hourNum)
                      );
                      const isTodaySlot = day.isToday;

                      return (
                        <div
                          key={day.dateStr + hour}
                          className={`relative border-r border-slate-100 dark:border-white/5 last:border-r-0 p-1 space-y-1 transition-all ${
                            isTodaySlot ? 'bg-blue-50/10 dark:bg-white/[0.02]' : ''
                          }`}
                        >
                          {isTodaySlot && isCurrentHourRow && (
                            <div
                              className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                              style={{ top: `${(currentMinute / 60) * 100}%` }}
                            >
                              <span className="w-2.5 h-2.5 rounded-full bg-[#ea4335] -ml-1.5 shadow-xs shrink-0" />
                              <span className="h-[2px] bg-[#ea4335] w-full" />
                            </div>
                          )}

                          {slotBookings.map((b) => {
                            const badgeStyle = getEventBadgeStyle(b, isDark);
                            const isStartHour = dayjs(b.start_at).hour() === hourNum;

                            if (!isStartHour) {
                              return (
                                <div
                                  key={b.id}
                                  onClick={(e) => onBookingClick(b, e)}
                                  className={`w-full h-full rounded-md px-2 py-1 text-xs border cursor-pointer opacity-90 ${badgeStyle.bg}`}
                                >
                                  <span className="text-[10px] opacity-80">
                                    {t.calendarContinuedMeeting}
                                  </span>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={b.id}
                                onClick={(e) => onBookingClick(b, e)}
                                className={`w-full rounded-md p-1.5 text-xs border shadow-2xs cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md ${badgeStyle.bg}`}
                              >
                                <div className="font-bold leading-tight line-clamp-1">
                                  {b.purpose || t.internalWorkMeeting}
                                </div>
                                <div className="text-[10px] opacity-90 font-mono mt-0.5 truncate">
                                  {dayjs(b.start_at).format('HH:mm')} - {dayjs(b.end_at).format('HH:mm')}
                                  {showRoomName && b.room_name ? ` · ${b.room_name}` : ''}
                                </div>
                                <div className="text-[10px] opacity-80 truncate mt-0.5">
                                  {b.user_name || t.roleEmployee}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : viewMode === 'month' ? (
        /* MONTH VIEW */
        <div className="p-3 sm:p-5 overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center">
              {(language === 'vi'
                ? ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
                : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
              ).map((dayName, idx) => (
                <div
                  key={idx}
                  className="text-xs font-bold text-slate-400 py-1 uppercase tracking-wider"
                >
                  {dayName}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {monthCalendarDays.map((d) => (
                <div
                  key={d.dateStr}
                  onClick={() => {
                    onCurrentDateChange(d.date);
                    onViewModeChange?.('day');
                  }}
                  className={`min-h-[88px] sm:min-h-[108px] p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    d.isToday
                      ? isDark
                        ? 'border-[#0a84ff] bg-[#0a84ff]/10 shadow-xs'
                        : 'border-[#1e40af] bg-blue-50/70 shadow-xs'
                      : d.isCurrentMonth
                      ? isDark
                        ? 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 shadow-2xs'
                      : isDark
                      ? 'border-white/5 bg-transparent opacity-40 hover:opacity-70'
                      : 'border-slate-100 bg-slate-50/40 opacity-40 hover:opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold font-mono ${
                        d.isToday
                          ? isDark
                            ? 'text-[#0a84ff]'
                            : 'text-[#1e40af]'
                          : d.isCurrentMonth
                          ? isDark
                            ? 'text-white'
                            : 'text-slate-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {d.dayNumber}
                    </span>
                    {d.dayBookings.length > 0 && (
                      <span
                        className={`text-[10px] px-1.5 rounded-full font-bold ${
                          isDark
                            ? 'bg-blue-500/20 text-[#64d2ff]'
                            : 'bg-blue-100 text-[#1e40af]'
                        }`}
                      >
                        {d.dayBookings.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 mt-1 overflow-hidden">
                    {d.dayBookings.slice(0, 2).map((b) => {
                      const badgeStyle = getEventBadgeStyle(b, isDark);
                      return (
                        <div
                          key={b.id}
                          onClick={(e) => onBookingClick(b, e)}
                          className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium border ${badgeStyle.bg}`}
                          title={`${dayjs(b.start_at).format('HH:mm')} - ${dayjs(b.end_at).format('HH:mm')}: ${b.purpose || t.internalWorkMeeting}`}
                        >
                          <span className="font-mono">{dayjs(b.start_at).format('HH:mm')}</span>{' '}
                          {b.purpose || t.internalWorkMeeting}
                        </div>
                      );
                    })}
                    {d.dayBookings.length > 2 && (
                      <div className="text-[10px] text-slate-400 font-semibold px-1">
                        +{d.dayBookings.length - 2}{' '}
                        {language === 'vi' ? 'cuộc họp khác' : 'more'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* YEAR VIEW */
        <div className="p-3 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {yearMonths.map((m) => (
              <div
                key={m.monthIndex}
                onClick={() => {
                  onCurrentDateChange(m.monthDate);
                  onViewModeChange?.('month');
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  m.isCurrentMonth
                    ? isDark
                      ? 'border-[#0a84ff] bg-[#0a84ff]/10 shadow-sm'
                      : 'border-[#1e40af] bg-blue-50/70 shadow-sm'
                    : isDark
                    ? 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm sm:text-base text-slate-800 dark:text-white">
                      {m.monthName}
                    </span>
                    {m.isCurrentMonth && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDark ? 'bg-[#0a84ff] text-white' : 'bg-[#1e40af] text-white'
                        }`}
                      >
                        {language === 'vi' ? 'Hiện tại' : 'Current'}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    {m.totalBookings > 0 ? (
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        <span>
                          {m.totalBookings}{' '}
                          {language === 'vi' ? 'cuộc họp đã lên lịch' : 'scheduled meetings'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">
                        {language === 'vi' ? 'Chưa có lịch họp' : 'No meetings scheduled'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-xs text-[#1e40af] dark:text-[#0a84ff] font-semibold">
                  <span>{language === 'vi' ? 'Xem chi tiết tháng' : 'View month'}</span>
                  <RightOutlined style={{ fontSize: 10 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export interface BookingPreviewModalProps {
  booking: Booking | null;
  open: boolean;
  onClose: () => void;
  onActionClick?: (booking: Booking) => void;
  actionLabel?: string;
}

/** Shared read-only meeting session detail modal opened from calendar cards. */
export const BookingPreviewModal: React.FC<BookingPreviewModalProps> = ({
  booking,
  open,
  onClose,
  onActionClick,
  actionLabel,
}) => {
  const { isDark } = useTheme();
  const { t, language } = useLanguage();

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div className="flex items-center gap-2">
          <CalendarOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
          <span className="font-bold text-base">{t.previewMeetingTitle}</span>
        </div>
      }
      footer={[
        <Button key="close" onClick={onClose} style={{ borderRadius: 6 }}>
          {t.close}
        </Button>,
        ...(booking && onActionClick
          ? [
              <Button
                key="action"
                type="primary"
                onClick={() => onActionClick(booking)}
                style={{
                  backgroundColor: isDark ? '#0a84ff' : '#1e40af',
                  borderColor: isDark ? '#0a84ff' : '#1e40af',
                  borderRadius: 6,
                }}
              >
                {actionLabel || t.bookThisRoomBtn}
              </Button>,
            ]
          : []),
      ]}
    >
      {booking && (
        <div className="flex flex-col gap-4 py-2 text-xs sm:text-sm">
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div>
              <div className="font-bold text-base text-slate-800 dark:text-slate-100">
                {booking.purpose || t.internalWorkMeeting}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {t.fieldRoom}: {booking.room_name}
              </div>
            </div>
            <Tag
              color={BOOKING_STATUS_CONFIG[booking.status]?.color || 'default'}
              className="m-0 font-medium"
            >
              {getBookingStatusLabel(booking.status, language)}
            </Tag>
          </div>

          <div
            className={`p-3.5 rounded-xl border flex flex-col gap-2.5 ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-500 dark:text-zinc-400">
                {t.meetingTimeLabel}:
              </span>
              <span className="font-mono font-bold text-black dark:text-white">
                {dayjs(booking.start_at).format('HH:mm')} -{' '}
                {dayjs(booking.end_at).format('HH:mm')}
                <span className="text-slate-500 dark:text-zinc-400 font-normal ml-2">
                  ({dayjs(booking.start_at).format('DD/MM/YYYY')})
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <UserOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
              <span className="font-semibold">{t.meetingOrganizer}:</span>
              <span>
                {booking.user_name || t.roleEmployee} ({booking.user_email})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <TeamOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
              <span className="font-semibold">{t.meetingAttendeesLabel}:</span>
              <span>
                {booking.num_attendees} {t.peopleUnit}
              </span>
            </div>
          </div>

          {booking.attendees.length > 0 && (
            <div
              className={`p-3.5 rounded-xl border w-full mx-auto ${
                isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="font-semibold text-xs text-slate-400 mb-3 text-center flex items-center justify-center gap-1.5 uppercase tracking-wider">
                <TeamOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
                <span>
                  {t.meetingAttendeeListLabel} ({booking.attendees.length})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto p-0.5 w-full">
                {booking.attendees.map((att) => (
                  <div
                    key={att.id}
                    className={`text-xs px-3 py-2 rounded-lg border flex items-center gap-2.5 w-full min-w-0 transition-colors ${
                      isDark
                        ? 'bg-[#242426] border-white/15 text-zinc-200'
                        : 'bg-white border-slate-200 text-slate-700 shadow-2xs'
                    }`}
                  >
                    <UserOutlined className="text-[#1e40af] dark:text-[#0a84ff] shrink-0 text-sm" />
                    <div className="min-w-0 flex-1 truncate text-left">
                      <div className="font-medium text-slate-800 dark:text-zinc-100 truncate">
                        {att.name}
                      </div>
                      {att.attendee_email && (
                        <div className="text-[11px] text-slate-400 truncate">
                          {att.attendee_email}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
