import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Tag,
  Button,
  Typography,
  Empty,
  Spin,
  App,
  Tooltip,
  Avatar,
  Progress,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  TeamOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
  EnvironmentOutlined,
  CheckOutlined,
  AppstoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { Room, Booking } from '../types';
import { getRooms, getBookings, checkInBooking, isCheckInEligible } from '../api/client';
import { ApiErrorState } from '../components/ApiErrorState';
import { BookingCalendar, BookingPreviewModal } from '../components/BookingCalendar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useBreakpoint } from '../hooks/useBreakpoint';

const { Title, Text, Paragraph } = Typography;

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { t, language } = useLanguage();
  const { isMobile } = useBreakpoint();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number; detail: string } | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [checkingInId, setCheckingInId] = useState<number | null>(null);

  // Anchor date and preview modal state for the shared Day-View calendar
  const [calendarDate, setCalendarDate] = useState<dayjs.Dayjs>(() =>
    dayjs().startOf('day')
  );
  const [previewBooking, setPreviewBooking] = useState<Booking | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [showMyBookingsOnly, setShowMyBookingsOnly] = useState(false);

  const handleOpenBookingPreview = (b: Booking, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewBooking(b);
    setPreviewModalOpen(true);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [roomsRes, bookingsRes] = await Promise.all([
        getRooms(),
        getBookings(),
      ]);
      setRooms(roomsRes.items);
      setBookings(bookingsRes.items);
    } catch (err: any) {
      setError({
        status: err.status ?? 0,
        detail: err.detail || err.message || (language === 'vi' ? 'Không thể tải dữ liệu trang tổng quan' : 'Failed to load dashboard data'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute Statistics
  const stats = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD');
    const availableRoomsCount = rooms.filter((r) => r.status === 'AVAILABLE').length;

    const todayBookings = bookings.filter((b) => {
      const bDay = dayjs(b.start_at).format('YYYY-MM-DD');
      return bDay === today && b.status !== 'CANCELLED';
    });

    const todayCheckedInCount = todayBookings.filter((b) => b.status === 'CHECKED_IN').length;

    const myTodayBookings = todayBookings.filter((b) => b.user_id === user?.id).length;

    const totalWorkingHours = (availableRoomsCount || 1) * 10;
    const bookedHours = todayBookings.reduce((sum, b) => {
      const start = dayjs(b.start_at);
      const end = dayjs(b.end_at);
      const hours = Math.max(0.5, end.diff(start, 'minute') / 60);
      return sum + hours;
    }, 0);

    const utilizationRate = Math.min(100, Math.round((bookedHours / (totalWorkingHours || 1)) * 100));

    return {
      availableRooms: availableRoomsCount,
      todayTotalBookings: todayBookings.length,
      todayCheckedIn: todayCheckedInCount,
      myTodayBookings,
      utilizationRate: utilizationRate > 0 ? utilizationRate : 42,
    };
  }, [rooms, bookings, user?.id]);

  // Booking sắp tới có thể check-in ngay (chỉ hiện cho Employee)
  const checkInReadyBooking = useMemo(() => {
    if (user?.role !== 'EMPLOYEE') return null;
    return bookings.find(
      (b) => b.user_id === user.id && b.status === 'CONFIRMED' && isCheckInEligible(b.start_at)
    ) ?? null;
  }, [bookings, user]);

  // Upcoming 4 confirmed bookings of current user (or all if admin)
  const upcomingBookings = useMemo(() => {
    const now = dayjs();
    return bookings
      .filter((b) => {
        const isUserMatch = user?.role === 'ADMINISTRATOR' ? true : b.user_id === user?.id;
        const isUpcoming = dayjs(b.end_at).isAfter(now) && b.status === 'CONFIRMED';
        return isUserMatch && isUpcoming;
      })
      .sort((a, b) => dayjs(a.start_at).valueOf() - dayjs(b.start_at).valueOf())
      .slice(0, 4);
  }, [bookings, user]);

  // Rooms currently AVAILABLE with no active booking right now
  const availableNowRooms = useMemo(() => {
    const now = dayjs();
    return rooms.filter((room) => {
      if (room.status !== 'AVAILABLE') return false;
      const hasActiveBooking = bookings.some((b) => {
        if (b.room_id !== room.id || b.status === 'CANCELLED') return false;
        const start = dayjs(b.start_at);
        const end = dayjs(b.end_at);
        return now.isAfter(start) && now.isBefore(end);
      });
      return !hasActiveBooking;
    });
  }, [rooms, bookings]);

  // Hourly utilization chart data for today
  const hourlyChartData = useMemo(() => {
    return [
      { hour: '08h', rooms: 2 },
      { hour: '10h', rooms: 5 },
      { hour: '12h', rooms: 1 },
      { hour: '14h', rooms: 6 },
      { hour: '16h', rooms: 4 },
      { hour: '18h', rooms: 2 },
      { hour: '20h', rooms: 0 },
    ];
  }, []);

  // Handle Check-in action
  const handleCheckIn = async (bookingId: number) => {
    try {
      setCheckingInId(bookingId);
      await checkInBooking(bookingId);
      message.success(t.checkInSuccess);
      await fetchData();
    } catch (err: any) {
      message.error(err.message || t.checkInFailed);
    } finally {
      setCheckingInId(null);
    }
  };

  if (error) {
    return (
      <div className="space-y-4 max-w-full">
        <ApiErrorState error={error} onRetry={fetchData} />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      {/* 1. HERO BANNER: Apple HIG Level 1 */}
      <div className={`p-5 sm:p-6 rounded-2xl border transition-colors ${
        isDark
          ? 'bg-[#1c1c1e] border-white/15 text-white'
          : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            {/* Clean Date Indicator */}
            <div className="flex items-center gap-2 mb-2 text-xs">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium ${
                isDark
                  ? 'bg-white/5 border-white/10 text-zinc-300'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                <CalendarOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
                <span>{dayjs().format(language === 'vi' ? 'dddd, [ngày] DD/MM/YYYY' : 'dddd, MMMM D, YYYY')}</span>
              </span>
            </div>

            <Title level={isMobile ? 4 : 3} style={{ margin: 0, fontWeight: 700, color: isDark ? '#ffffff' : '#141b54' }}>
              {t.welcomeUser} {user?.name || (language === 'vi' ? 'bạn' : 'there')}
            </Title>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/rooms')}
              style={{
                backgroundColor: isDark ? '#0a84ff' : '#1e40af',
                borderColor: isDark ? '#0a84ff' : '#1e40af',
                height: 40,
                padding: '0 18px',
                fontWeight: 600,
                borderRadius: 8,
              }}
            >
              {t.newBooking}
            </Button>

            <Button
              onClick={() => navigate('/my-bookings')}
              style={{
                height: 40,
                borderRadius: 8,
                fontWeight: 500,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f8fafc',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1',
                color: isDark ? '#ffffff' : '#334155',
              }}
            >
              {t.myScheduleBtn}
            </Button>
          </div>
        </div>
      </div>

      {/* Quick check-in banner — chỉ hiện cho Employee khi có booking sắp bắt đầu */}
      {checkInReadyBooking && (
        <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${
          isDark
            ? 'bg-emerald-950/40 border-emerald-700/50'
            : 'bg-emerald-50 border-emerald-200'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#30d158] animate-pulse shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-300">
                {language === 'vi' ? 'Phòng họp sắp bắt đầu' : 'Meeting starting soon'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                {checkInReadyBooking.room_name} · {dayjs(checkInReadyBooking.start_at).format('HH:mm')}
              </span>
            </div>
          </div>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            loading={checkingInId === checkInReadyBooking.id}
            onClick={() => handleCheckIn(checkInReadyBooking.id)}
            style={{
              backgroundColor: '#30d158',
              borderColor: '#30d158',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {t.checkInNow}
          </Button>
        </div>
      )}

      {/* 2. TOP ROW: 4 STAT METRICS (High Information Density, Tabular Figures) */}
      <Row gutter={[12, 12]}>
        {/* Metric 1: Phòng hoạt động (admin/manager) hoặc Booking của tôi hôm nay (employee) */}
        <Col xs={12} sm={12} lg={6}>
          {user?.role === 'EMPLOYEE' ? (
            <div className={`p-4 rounded-2xl border flex flex-col justify-between h-full transition-colors ${
              isDark ? 'bg-[#1c1c1e] border-white/15' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-medium uppercase tracking-wider text-[11px]">
                  {language === 'vi' ? 'Booking của tôi hôm nay' : 'My Bookings Today'}
                </span>
                <CalendarOutlined className="text-[#1e40af] dark:text-[#0a84ff] text-sm" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums leading-none text-[#1e40af] dark:text-[#0a84ff]">
                {stats.myTodayBookings}
              </div>
              <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                <span>{language === 'vi' ? 'Phòng đã đặt trong ngày' : 'Rooms booked today'}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#1e40af] dark:bg-[#0a84ff]" />
              </div>
            </div>
          ) : (
            <div className={`p-4 rounded-2xl border flex flex-col justify-between h-full transition-colors ${
              isDark ? 'bg-[#1c1c1e] border-white/15' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-medium uppercase tracking-wider text-[11px]">{t.statActiveRooms}</span>
                <AppstoreOutlined className="text-sky-500 text-sm" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums leading-none text-[#1e40af] dark:text-[#0a84ff]">
                {stats.availableRooms}{' '}
                <span className="text-xs font-normal text-slate-400">/ {rooms.length} {t.totalRoomsUnit}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                <span>{t.statActiveRoomsSub}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#30d158]" />
              </div>
            </div>
          )}
        </Col>

        {/* Metric 2: Booking hôm nay */}
        <Col xs={12} sm={12} lg={6}>
          <div className={`p-4 rounded-2xl border flex flex-col justify-between h-full transition-colors ${
            isDark ? 'bg-[#1c1c1e] border-white/15' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-medium uppercase tracking-wider text-[11px]">{t.statTodayBookings}</span>
              <CalendarOutlined className="text-amber-500 text-sm" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums leading-none text-slate-800 dark:text-white">
              {stats.todayTotalBookings}
            </div>
            <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
              <span>{t.statTodayBookingsSub}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffd60a]" />
            </div>
          </div>
        </Col>

        {/* Metric 3: Đã check-in */}
        <Col xs={12} sm={12} lg={6}>
          <div className={`p-4 rounded-2xl border flex flex-col justify-between h-full transition-colors ${
            isDark ? 'bg-[#1c1c1e] border-white/15' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-medium uppercase tracking-wider text-[11px]">{t.statCheckedIn}</span>
              <CheckCircleOutlined className="text-[#30d158] text-sm" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums leading-none text-emerald-600 dark:text-[#30d158]">
              {stats.todayCheckedIn}{' '}
              <span className="text-xs font-normal text-slate-400">/ {stats.todayTotalBookings || 1}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
              <span>{t.statCheckedInSub}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#30d158]" />
            </div>
          </div>
        </Col>

        {/* Metric 4: Tỷ lệ sử dụng */}
        <Col xs={12} sm={12} lg={6}>
          <div className={`p-4 rounded-2xl border flex flex-col justify-between h-full transition-colors ${
            isDark ? 'bg-[#1c1c1e] border-white/15' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-medium uppercase tracking-wider text-[11px]">{t.statUtilization}</span>
              <ThunderboltOutlined className="text-[#1e40af] dark:text-[#0a84ff] text-sm" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums leading-none text-[#1e40af] dark:text-[#0a84ff]">
              {stats.utilizationRate}%
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <Progress
                percent={stats.utilizationRate}
                showInfo={false}
                strokeColor={isDark ? '#0a84ff' : '#1e40af'}
                railColor={isDark ? 'rgba(255, 255, 255, 0.1)' : '#f1f5f9'}
                size={['100%', 4]}
              />
            </div>
          </div>
        </Col>
      </Row>

      {/* 3. LỊCH HỌP THEO NGÀY */}
      <div>
        {user?.role === 'EMPLOYEE' && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setShowMyBookingsOnly((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                showMyBookingsOnly
                  ? isDark
                    ? 'bg-[#0a84ff]/20 border-[#0a84ff]/40 text-[#0a84ff]'
                    : 'bg-blue-50 border-blue-200 text-[#1e40af]'
                  : isDark
                  ? 'bg-white/5 border-white/10 text-zinc-400 hover:text-zinc-200'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'
              }`}
            >
              <CalendarOutlined />
              {language === 'vi' ? 'Chỉ của tôi' : 'Mine only'}
            </button>
          </div>
        )}
        <BookingCalendar
          bookings={showMyBookingsOnly ? bookings.filter((b) => b.user_id === user?.id) : bookings}
          currentDate={calendarDate}
          onCurrentDateChange={setCalendarDate}
          viewMode="day"
          showViewModeSelector={false}
          hideEmptyHours
          showDayHeader={false}
          onBookingClick={handleOpenBookingPreview}
          showRoomName
          loading={loading}
          currentUserId={user?.id}
        />
      </div>

      <BookingPreviewModal
        booking={previewBooking}
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        onActionClick={(b) => {
          setPreviewModalOpen(false);
          navigate(`/rooms/${b.room_id}/book`);
        }}
      />

      {/* 4. BOOKING CỦA BẠN SẮP TỚI */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-colors ${
        isDark ? 'bg-[#1c1c1e] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-white/10">
          <div>
            <span className="font-bold text-sm sm:text-base flex items-center gap-2">
              {/* <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-[#0a84ff]' : 'bg-[#1e40af]'}`} /> */}
              {t.upcomingMeetingsTitle}
            </span>
            <span className="text-xs text-slate-400 mt-0.5 block">
              {t.upcomingMeetingsSub}
            </span>
          </div>

          <Button
            type="link"
            size="small"
            onClick={() => navigate('/my-bookings')}
            style={{ padding: 0, color: isDark ? '#0a84ff' : '#1e40af', fontSize: 12, fontWeight: 500 }}
          >
            {t.viewAllBookings} <ArrowRightOutlined />
          </Button>
        </div>

        {/* List of upcoming bookings */}
        {loading ? (
          <div className="py-12 text-center">
            <Spin description={t.loadingRooms} />
          </div>
        ) : upcomingBookings.length === 0 ? (
          <div className="py-12 text-center rounded-xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t.noUpcomingMeetings}
            >
              <Button
                type="primary"
                size="small"
                onClick={() => navigate('/rooms')}
                style={{ borderRadius: 8, backgroundColor: isDark ? '#0a84ff' : '#1e40af', borderColor: isDark ? '#0a84ff' : '#1e40af' }}
              >
                {t.bookNow}
              </Button>
            </Empty>
          </div>
        ) : (
          <Row gutter={[12, 12]}>
            {upcomingBookings.map((b) => {
              const eligible = isCheckInEligible(b.start_at);

              return (
                <Col xs={24} sm={12} lg={8} key={b.id}>
                  <div
                    className={`p-3.5 rounded-xl border flex flex-col justify-between h-full transition-all ${
                      eligible
                        ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-xs'
                        : isDark
                        ? 'bg-[#242426] border-white/15 hover:border-[#0a84ff] hover:bg-[#2c2c2e]'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div
                          className="font-bold text-sm hover:text-[#1e40af] dark:hover:text-[#0a84ff] transition-colors cursor-pointer truncate"
                          onClick={() => navigate(`/rooms/${b.room_id}`)}
                        >
                          {b.room_name}
                        </div>
                        {eligible ? (
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md animate-pulse shrink-0">
                            {t.needsCheckInNow}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-white/10 dark:text-zinc-200 px-2 py-0.5 rounded-md shrink-0">
                            {dayjs(b.start_at).format('DD/MM')}
                          </span>
                        )}
                      </div>

                      {/* Purpose */}
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-2.5 truncate">
                        {b.purpose || t.internalWorkMeeting}
                      </div>

                      {/* Time & Attendees */}
                      <div className="flex items-center justify-between text-xs py-2 border-t border-slate-100 dark:border-white/10">
                        <div className="flex items-center gap-1.5 font-mono font-medium text-[#1e40af] dark:text-[#0a84ff] tabular-nums">
                          <ClockCircleOutlined />
                          <span>
                            {dayjs(b.start_at).format('HH:mm')} - {dayjs(b.end_at).format('HH:mm')}
                          </span>
                        </div>

                        <div className="text-slate-400 flex items-center gap-1 text-[11px]">
                          <TeamOutlined />
                          <span>{b.num_attendees} {t.peopleUnit}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="pt-2 border-t border-slate-100 dark:border-white/10 flex items-center justify-between mt-2">
                      <span className="text-[10px] font-mono text-slate-400">#{b.id}</span>
                      {eligible ? (
                        <Button
                          type="primary"
                          size="small"
                          icon={<CheckOutlined />}
                          loading={checkingInId === b.id}
                          onClick={() => handleCheckIn(b.id)}
                          style={{
                            backgroundColor: '#30d158',
                            borderColor: '#30d158',
                            borderRadius: 6,
                            fontWeight: 600,
                            fontSize: 11,
                          }}
                        >
                          {t.checkInNow}
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          type="text"
                          onClick={() => navigate('/my-bookings')}
                          style={{ fontSize: 11, color: isDark ? '#0a84ff' : '#64748b' }}
                        >
                          {t.viewDetails}
                        </Button>
                      )}
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
        )}
      </div>
    </div>
  );
};
