import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Tag,
  Button,
  Typography,
  Spin,
  App,
  Progress,
  Segmented,
  Badge,
} from 'antd';
import {
  CheckCircleOutlined,
  CalendarOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
  EnvironmentOutlined,
  CheckOutlined,
  AppstoreOutlined,
  PlusOutlined,
  UserOutlined,
  SettingOutlined,
  AuditOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  BarChart,
  Bar,
} from 'recharts';
import { Room, Booking, EquipmentItem, EQUIPMENT_STATUS_CONFIG, UserAccount, BookingPolicyConfig, AuditLogEntry, AuditActionType } from '../types';
import { getRooms, getBookings, checkInBooking, isCheckInEligible, getEquipmentList } from '../api/client';
import { getReportStats, ReportStatsResponse } from '../api/reports';
import { getUserAccounts } from '../api/users';
import { getAuditLogs } from '../api/auditLogs';
import { getBookingPolicies } from '../api/policies';
import { ApiErrorState } from '../components/ApiErrorState';
import { BookingCalendar, BookingPreviewModal } from '../components/BookingCalendar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useBreakpoint } from '../hooks/useBreakpoint';

const { Title } = Typography;

type TimeRange = '7days' | '30days' | 'quarter';

const ACTION_TAG_CONFIG: Partial<Record<AuditActionType, { color: string; labelVi: string; labelEn: string }>> = {
  USER_ROLE_CHANGED: { color: 'purple', labelVi: 'Đổi vai trò', labelEn: 'Role Changed' },
  USER_STATUS_TOGGLED: { color: 'orange', labelVi: 'Khóa/Mở TK', labelEn: 'Status Toggled' },
  USER_CREATED: { color: 'green', labelVi: 'Tạo người dùng', labelEn: 'User Created' },
  BOOKING_CREATED: { color: 'blue', labelVi: 'Đặt phòng', labelEn: 'Booking Created' },
  BOOKING_CANCELLED: { color: 'orange', labelVi: 'Hủy đặt phòng', labelEn: 'Booking Cancelled' },
  BOOKING_CHECKED_IN: { color: 'lime', labelVi: 'Check-in', labelEn: 'Checked In' },
  ROOM_CREATED: { color: 'cyan', labelVi: 'Tạo phòng', labelEn: 'Room Created' },
  ROOM_UPDATED: { color: 'geekblue', labelVi: 'Sửa phòng', labelEn: 'Room Updated' },
  POLICY_CONFIG_UPDATED: { color: 'magenta', labelVi: 'Cập nhật cấu hình', labelEn: 'Policy Updated' },
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { t, language } = useLanguage();
  const { isMobile } = useBreakpoint();
  const { message } = App.useApp();

  const isManagerOrAdmin = user?.role === 'ROOM_MANAGER' || user?.role === 'ADMINISTRATOR';
  const isAdmin = user?.role === 'ADMINISTRATOR';

  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<{ status: number; detail: string } | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [checkingInId, setCheckingInId] = useState<number | null>(null);
  const [systemUpcomingCheckInCount, setSystemUpcomingCheckInCount] = useState(0);

  // Admin/Manager stats
  const [statsData, setStatsData] = useState<ReportStatsResponse | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([]);
  const [policyConfig, setPolicyConfig] = useState<BookingPolicyConfig | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');

  // Calendar state
  const [calendarDate, setCalendarDate] = useState<dayjs.Dayjs>(() => dayjs().startOf('day'));
  const [previewBooking, setPreviewBooking] = useState<Booking | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const handleOpenBookingPreview = (b: Booking, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewBooking(b);
    setPreviewModalOpen(true);
  };

  const fetchStats = async (range: TimeRange) => {
    if (!isManagerOrAdmin) return;
    try {
      setStatsLoading(true);
      const daysAgo = range === '7days' ? 7 : range === '30days' ? 30 : 90;
      const endDate = dayjs().format('YYYY-MM-DD');
      const startDate = dayjs().subtract(daysAgo, 'day').format('YYYY-MM-DD');
      const data = await getReportStats(startDate, endDate);
      setStatsData(data);
    } catch (err: any) {
      if (err?.status === 401) return;
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const now = dayjs();

      const [roomsRes, bookingsRes, eqRes, confirmedRes] = await Promise.all([
        getRooms(),
        getBookings(),
        isManagerOrAdmin ? getEquipmentList({}) : Promise.resolve([]),
        isManagerOrAdmin
          ? getBookings({ status: 'CONFIRMED', limit: 100 })
          : Promise.resolve({ items: [], total: 0, limit: 0, offset: 0 }),
      ]);

      setRooms(roomsRes.items);
      setBookings(bookingsRes.items);
      setEquipment(Array.isArray(eqRes) ? eqRes : []);

      if (isManagerOrAdmin) {
        const upcomingCount = confirmedRes.items.filter((b) => dayjs(b.start_at).isAfter(now)).length;
        setSystemUpcomingCheckInCount(upcomingCount);
      }

      // Admin-only supplementary data
      if (isAdmin) {
        const [usersRes, logsRes, policiesRes] = await Promise.all([
          getUserAccounts(),
          getAuditLogs({ limit: 5 }),
          getBookingPolicies(),
        ]);
        setUsers(usersRes);
        setRecentLogs(logsRes);
        setPolicyConfig(policiesRes);
      }
    } catch (err: any) {
      if (err?.status === 401) return;
      setError({
        status: err?.status ?? 0,
        detail: err?.detail || err?.message || (language === 'vi' ? 'Không thể tải dữ liệu trang tổng quan' : 'Failed to load dashboard data'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // fetchStats gọi khi mount (timeRange mặc định '7days') và khi user đổi kỳ
  useEffect(() => {
    fetchStats(timeRange);
  }, [timeRange]);

  // ── Core stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD');
    const availableRoomsCount = rooms.filter((r) => r.status === 'AVAILABLE').length;

    const todayBookings = bookings.filter((b) => {
      const bDay = dayjs(b.start_at).format('YYYY-MM-DD');
      return bDay === today && b.status !== 'CANCELLED';
    });

    const todayCheckedInCount = todayBookings.filter((b) => b.status === 'CHECKED_IN').length;
    const myTodayBookings = todayBookings.filter((b) => b.user_id === user?.id).length;
    const myPendingCheckIn = todayBookings.filter(
      (b) => b.user_id === user?.id && b.status === 'CONFIRMED'
    ).length;

    const now = dayjs();
    const availableNowCount = rooms.filter((room) => {
      if (room.status !== 'AVAILABLE') return false;
      return !bookings.some(
        (b) => b.room_id === room.id && b.status !== 'CANCELLED'
          && now.isAfter(dayjs(b.start_at)) && now.isBefore(dayjs(b.end_at))
      );
    }).length;

    const totalWorkingHours = (availableRoomsCount || 1) * 10;
    const bookedHours = todayBookings.reduce((sum, b) => {
      const start = dayjs(b.start_at);
      const end = dayjs(b.end_at);
      return sum + Math.max(0.5, end.diff(start, 'minute') / 60);
    }, 0);

    const utilizationRate = Math.min(100, Math.round((bookedHours / (totalWorkingHours || 1)) * 100));

    return {
      availableRooms: availableRoomsCount,
      todayTotalBookings: todayBookings.length,
      todayCheckedIn: todayCheckedInCount,
      myTodayBookings,
      myPendingCheckIn,
      availableNowCount,
      utilizationRate,
    };
  }, [rooms, bookings, user?.id]);

  const equipmentStats = useMemo(() => ({
    functional: equipment.filter((e) => e.status === 'FUNCTIONAL').length,
    underRepair: equipment.filter((e) => e.status === 'UNDER_REPAIR').length,
    decommissioned: equipment.filter((e) => e.status === 'DECOMMISSIONED').length,
    total: equipment.length,
  }), [equipment]);

  // ── Chart data ───────────────────────────────────────────────────────────────
  const dailyChartData = useMemo(() => {
    if (!statsData) return [];
    return statsData.daily_stats.map((d) => ({
      name: dayjs(d.date).format('DD/MM'),
      [language === 'vi' ? 'Đã xác nhận' : 'Confirmed']: d.total - d.checked_in - d.cancelled,
      [language === 'vi' ? 'Đã check-in' : 'Checked In']: d.checked_in,
      [language === 'vi' ? 'Đã hủy' : 'Cancelled']: d.cancelled,
    }));
  }, [statsData, language]);

  const statusDonutData = useMemo(() => {
    if (!statsData) return [];
    return [
      { name: language === 'vi' ? 'Xác nhận' : 'Confirmed', value: statsData.confirmed || 0, fill: '#1e5bef' },
      { name: language === 'vi' ? 'Check-in' : 'Checked In', value: statsData.checked_in || 0, fill: '#52c41a' },
      { name: language === 'vi' ? 'Đã hủy' : 'Cancelled', value: statsData.cancelled || 0, fill: '#ff4d4f' },
    ];
  }, [statsData, language]);

  const peakHoursData = useMemo(() => {
    if (!statsData) return [];
    return statsData.peak_hours
      .filter((h) => h.hour >= 7 && h.hour <= 19)
      .map((h) => ({ hour: `${h.hour}h`, total: h.total }));
  }, [statsData]);

  const topRoomsData = useMemo(() => {
    if (!statsData) return [];
    return statsData.top_rooms.slice(0, 5);
  }, [statsData]);

  // ── User stats ───────────────────────────────────────────────────────────────
  const userStats = useMemo(() => ({
    total: users.length,
    employee: users.filter((u) => u.role === 'EMPLOYEE').length,
    manager: users.filter((u) => u.role === 'ROOM_MANAGER').length,
    admin: users.filter((u) => u.role === 'ADMINISTRATOR').length,
    suspended: users.filter((u) => u.status === 'SUSPENDED').length,
  }), [users]);

  // ── Check-in eligible ────────────────────────────────────────────────────────
  const checkInReadyBooking = useMemo(() => {
    if (user?.role !== 'EMPLOYEE') return null;
    return bookings.find(
      (b) => b.user_id === user.id && b.status === 'CONFIRMED' && isCheckInEligible(b.start_at)
    ) ?? null;
  }, [bookings, user]);

  const handleCheckIn = async (bookingId: number) => {
    try {
      setCheckingInId(bookingId);
      await checkInBooking(bookingId);
      message.success(t.checkInSuccess);
      await fetchData();
    } catch (err: any) {
      if (err?.status === 401) return;
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

  // ── Shared card wrapper ───────────────────────────────────────────────────────
  const card = (className?: string) =>
    `p-4 rounded-2xl border flex flex-col transition-colors ${
      isDark ? 'bg-[#1c1c1e] border-white/15' : 'bg-white border-slate-200'
    } ${className ?? ''}`;

  const labelClass = 'font-medium uppercase tracking-wider text-[11px] text-slate-400';

  const timeRangeOptions = [
    { label: language === 'vi' ? '7 ngày' : '7 Days', value: '7days' },
    { label: language === 'vi' ? '30 ngày' : '30 Days', value: '30days' },
    { label: language === 'vi' ? 'Quý' : 'Quarter', value: 'quarter' },
  ];

  return (
    <div className="space-y-5 pb-4">

      {/* ── HERO BANNER ───────────────────────────────────────────────────────── */}
      <div className={`p-5 sm:p-6 rounded-2xl border transition-colors ${
        isDark ? 'bg-[#1c1c1e] border-white/15' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium ${
                isDark ? 'bg-white/5 border-white/10 text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                <CalendarOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
                <span>{(() => { const s = dayjs().format(language === 'vi' ? 'dddd, [ngày] DD/MM/YYYY' : 'dddd, MMMM D, YYYY'); return s.charAt(0).toUpperCase() + s.slice(1); })()}</span>
              </span>
            </div>
            <Title level={isMobile ? 4 : 3} style={{ margin: 0, fontWeight: 700, color: isDark ? '#ffffff' : '#141b54' }}>
              {t.welcomeUser} {user?.name || (language === 'vi' ? 'bạn' : 'there')}
            </Title>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/rooms')}
              style={{ backgroundColor: isDark ? '#0a84ff' : '#1e40af', borderColor: isDark ? '#0a84ff' : '#1e40af', height: 40, padding: '0 18px', fontWeight: 600, borderRadius: 8 }}
            >
              {t.newBooking}
            </Button>
            <Button
              onClick={() => navigate('/my-bookings')}
              style={{ height: 40, borderRadius: 8, fontWeight: 500, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f8fafc', borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1', color: isDark ? '#ffffff' : '#334155' }}
            >
              {t.myScheduleBtn}
            </Button>
          </div>
        </div>
      </div>

      {/* ── QUICK CHECK-IN BANNER (Employee) ──────────────────────────────────── */}
      {checkInReadyBooking && (
        <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${
          isDark ? 'bg-emerald-950/40 border-emerald-700/50' : 'bg-emerald-50 border-emerald-200'
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
            type="primary" size="small" icon={<CheckOutlined />}
            loading={checkingInId === checkInReadyBooking.id}
            onClick={() => handleCheckIn(checkInReadyBooking.id)}
            style={{ backgroundColor: '#30d158', borderColor: '#30d158', borderRadius: 6, fontWeight: 600, fontSize: 12, flexShrink: 0 }}
          >
            {t.checkInNow}
          </Button>
        </div>
      )}

      {/* ── KPI CARDS ─────────────────────────────────────────────────────────── */}
      {user?.role === 'EMPLOYEE' ? (
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={8}>
            <div className={card('justify-between h-full')}>
              <div className="flex items-center justify-between mb-2">
                <span className={labelClass}>{language === 'vi' ? 'Phòng trống ngay bây giờ' : 'Rooms Available Now'}</span>
                <EnvironmentOutlined className="text-sky-500 text-sm" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#1e40af] dark:text-sky-400">
                {stats.availableNowCount}{' '}
                <span className="text-xs font-normal text-slate-400">/ {rooms.length}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                {language === 'vi' ? 'Có thể đặt ngay' : 'Ready to book'}
              </div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div className={card('justify-between h-full')}>
              <div className="flex items-center justify-between mb-2">
                <span className={labelClass}>{language === 'vi' ? 'Lịch của tôi hôm nay' : 'My Schedule Today'}</span>
                <CalendarOutlined className="text-[#1e40af] dark:text-[#0a84ff] text-sm" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#1e40af] dark:text-[#0a84ff]">
                {stats.myTodayBookings}
              </div>
              <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                {language === 'vi' ? 'Phòng đã đặt trong ngày' : 'Rooms booked today'}
              </div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div className={`p-4 rounded-2xl border flex flex-col h-full transition-colors ${
              checkInReadyBooking
                ? isDark ? 'bg-emerald-950/30 border-emerald-700/50' : 'bg-emerald-50 border-emerald-200'
                : isDark ? 'bg-[#1c1c1e] border-white/15' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={labelClass}>{language === 'vi' ? 'Chờ check-in' : 'Pending Check-in'}</span>
                <CheckCircleOutlined className="text-[#30d158] text-sm" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-emerald-600 dark:text-[#30d158] flex-1">
                {stats.myPendingCheckIn}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/10 flex items-center justify-between gap-2">
                {checkInReadyBooking ? (
                  <>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium truncate">
                      {checkInReadyBooking.room_name} · {dayjs(checkInReadyBooking.start_at).format('HH:mm')}
                    </span>
                    <Button type="primary" size="small" icon={<CheckOutlined />}
                      loading={checkingInId === checkInReadyBooking.id}
                      onClick={() => handleCheckIn(checkInReadyBooking.id)}
                      style={{ backgroundColor: '#30d158', borderColor: '#30d158', borderRadius: 6, fontWeight: 600, fontSize: 11, flexShrink: 0 }}
                    >
                      {t.checkInNow}
                    </Button>
                  </>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    {language === 'vi' ? 'Không có booking cần check-in' : 'No pending check-in'}
                  </span>
                )}
              </div>
            </div>
          </Col>
        </Row>
      ) : (
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={12} lg={6}>
            <div className={card('justify-between h-full')}>
              <div className="flex items-center justify-between mb-2">
                <span className={labelClass}>{t.statActiveRooms}</span>
                <AppstoreOutlined className="text-sky-500 text-sm" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#1e40af] dark:text-[#0a84ff]">
                {stats.availableRooms}{' '}
                <span className="text-xs font-normal text-slate-400">/ {rooms.length} {t.totalRoomsUnit}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                {t.statActiveRoomsSub}
              </div>
            </div>
          </Col>
          <Col xs={12} sm={12} lg={6}>
            <div className={card('justify-between h-full')}>
              <div className="flex items-center justify-between mb-2">
                <span className={labelClass}>{t.statTodayBookings}</span>
                <CalendarOutlined className="text-amber-500 text-sm" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-800 dark:text-white">
                {stats.todayTotalBookings}
              </div>
              <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                {t.statTodayBookingsSub}
              </div>
            </div>
          </Col>
          <Col xs={12} sm={12} lg={6}>
            <div className={card('justify-between h-full')}>
              <div className="flex items-center justify-between mb-2">
                <span className={labelClass}>{language === 'vi' ? 'Check-in sắp tới' : 'Upcoming Check-ins'}</span>
                <CheckCircleOutlined className="text-[#30d158] text-sm" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-emerald-600 dark:text-[#30d158]">
                {systemUpcomingCheckInCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                {language === 'vi' ? 'Booking đã xác nhận, chưa check-in' : 'Confirmed, not yet checked in'}
              </div>
            </div>
          </Col>
          <Col xs={12} sm={12} lg={6}>
            {user?.role === 'ROOM_MANAGER' ? (
              <div className={card('h-full')}>
                <div className="mb-1">
                  <span className={labelClass}>{language === 'vi' ? 'Thiết bị' : 'Equipment'}</span>
                </div>
                <div className="flex items-center justify-center flex-1 py-1">
                  <PieChart width={110} height={90}>
                    <Pie data={[
                      { name: language === 'vi' ? 'Hoạt động' : 'Functional', value: equipmentStats.functional || 0.01, fill: EQUIPMENT_STATUS_CONFIG.FUNCTIONAL.tagColor },
                      { name: language === 'vi' ? 'Đang sửa' : 'Under Repair', value: equipmentStats.underRepair || 0.01, fill: EQUIPMENT_STATUS_CONFIG.UNDER_REPAIR.tagColor },
                      { name: language === 'vi' ? 'Ngừng dùng' : 'Decommissioned', value: equipmentStats.decommissioned || 0.01, fill: EQUIPMENT_STATUS_CONFIG.DECOMMISSIONED.tagColor },
                    ]} cx={51} cy={43} innerRadius={28} outerRadius={42} dataKey="value" strokeWidth={0} />

                    <RechartsTooltip contentStyle={{ backgroundColor: isDark ? '#2c2c2e' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0'}`, borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </div>
                <div className="flex justify-around text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-white/5">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{equipmentStats.functional} {language === 'vi' ? 'HĐ' : 'OK'}</span>
                  <span className="text-amber-500 font-medium">{equipmentStats.underRepair} {language === 'vi' ? 'Sửa' : 'Fix'}</span>
                  <span className="text-red-500 font-medium">{equipmentStats.decommissioned} {language === 'vi' ? 'Ngừng' : 'Off'}</span>
                </div>
              </div>
            ) : (
              <div className={card('justify-between h-full')}>
                <div className="flex items-center justify-between mb-2">
                  <span className={labelClass}>{t.statUtilization}</span>
                  <ThunderboltOutlined className="text-[#1e40af] dark:text-[#0a84ff] text-sm" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#1e40af] dark:text-[#0a84ff]">
                  {stats.utilizationRate}%
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                  <Progress percent={stats.utilizationRate} showInfo={false}
                    strokeColor={isDark ? '#0a84ff' : '#1e40af'}
                    railColor={isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9'}
                    size={['100%', 4]}
                  />
                </div>
              </div>
            )}
          </Col>
        </Row>
      )}

      {/* ── MANAGER / ADMIN STATS SECTION ─────────────────────────────────────── */}
      {isManagerOrAdmin && (
        <>
          {/* Time range selector */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {language === 'vi' ? 'Thống kê hệ thống' : 'System Statistics'}
            </span>
            <Segmented
              options={timeRangeOptions}
              value={timeRange}
              onChange={(v) => setTimeRange(v as TimeRange)}
              style={{ fontSize: 12 }}
            />
          </div>

          {/* Row 2: Area chart + Status donut */}
          <Row gutter={[12, 12]}>
            {/* Area chart xu hướng booking */}
            <Col xs={24} lg={15}>
              <div className={card('h-full')}>
                <div className={`${labelClass} mb-3`}>
                  {language === 'vi' ? 'Xu hướng booking' : 'Booking Trend'}
                </div>
                {statsLoading ? (
                  <div className="flex items-center justify-center h-40"><Spin /></div>
                ) : dailyChartData.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
                    {language === 'vi' ? 'Chưa có dữ liệu' : 'No data yet'}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={dailyChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gConfirmed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1e5bef" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#1e5bef" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gCheckedIn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#52c41a" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gCancelled" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ff4d4f" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#ff4d4f" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#a1a1a6' : '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: isDark ? '#a1a1a6' : '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <RechartsTooltip contentStyle={{ backgroundColor: isDark ? '#2c2c2e' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0'}`, borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey={language === 'vi' ? 'Đã xác nhận' : 'Confirmed'} stroke="#1e5bef" strokeWidth={2} fill="url(#gConfirmed)" />
                      <Area type="monotone" dataKey={language === 'vi' ? 'Đã check-in' : 'Checked In'} stroke="#52c41a" strokeWidth={2} fill="url(#gCheckedIn)" />
                      <Area type="monotone" dataKey={language === 'vi' ? 'Đã hủy' : 'Cancelled'} stroke="#ff4d4f" strokeWidth={1.5} fill="url(#gCancelled)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
                <div className="flex gap-4 mt-2 flex-wrap">
                  {[{ color: '#1e5bef', label: language === 'vi' ? 'Xác nhận' : 'Confirmed' }, { color: '#52c41a', label: language === 'vi' ? 'Check-in' : 'Checked In' }, { color: '#ff4d4f', label: language === 'vi' ? 'Hủy' : 'Cancelled' }].map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-[11px] text-slate-400">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Col>

            {/* Status donut */}
            <Col xs={24} lg={9}>
              <div className={card('h-full items-center')}>
                <div className={`${labelClass} mb-2 self-start`}>
                  {language === 'vi' ? 'Phân bổ trạng thái' : 'Status Distribution'}
                </div>
                {statsLoading ? (
                  <div className="flex items-center justify-center h-40"><Spin /></div>
                ) : (
                  <>
                    <PieChart width={150} height={150}>
                      <Pie data={statusDonutData.length && statusDonutData.some(d => d.value > 0) ? statusDonutData : [{ name: '', value: 1, fill: isDark ? '#3a3a3c' : '#f1f5f9' }]}
                        cx={71} cy={71} innerRadius={42} outerRadius={65} dataKey="value" strokeWidth={0}
                      />
                      <RechartsTooltip contentStyle={{ backgroundColor: isDark ? '#2c2c2e' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0'}`, borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                    <div className="space-y-2 w-full mt-1">
                      {statusDonutData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                            <span className="text-slate-500 dark:text-slate-400">{item.name}</span>
                          </div>
                          <span className="font-mono font-bold text-slate-700 dark:text-zinc-200">{item.value}</span>
                        </div>
                      ))}
                      {statsData && (
                        <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-white/5">
                          {language === 'vi' ? 'Tổng' : 'Total'}: <strong className="text-slate-700 dark:text-zinc-100">{statsData.total}</strong>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Col>
          </Row>

          {/* Row 3: Peak hours + Top rooms + Equipment */}
          <Row gutter={[12, 12]}>
            {/* Peak hours */}
            <Col xs={24} sm={12} lg={9}>
              <div className={card('h-full')}>
                <div className={`${labelClass} mb-3`}>
                  {language === 'vi' ? 'Giờ cao điểm' : 'Peak Hours'}
                </div>
                {statsLoading ? (
                  <div className="flex items-center justify-center h-32"><Spin /></div>
                ) : peakHoursData.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
                    {language === 'vi' ? 'Chưa có dữ liệu' : 'No data yet'}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={peakHoursData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 10, fill: isDark ? '#a1a1a6' : '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="hour" tick={{ fontSize: 10, fill: isDark ? '#a1a1a6' : '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
                      <RechartsTooltip contentStyle={{ backgroundColor: isDark ? '#2c2c2e' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0'}`, borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={12} fill={isDark ? '#0a84ff' : '#1e40af'} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Col>

            {/* Top rooms */}
            <Col xs={24} sm={12} lg={9}>
              <div className={card('h-full')}>
                <div className={`${labelClass} mb-3`}>
                  {language === 'vi' ? 'Top 5 phòng được đặt nhiều nhất' : 'Top 5 Most Booked Rooms'}
                </div>
                {statsLoading ? (
                  <div className="flex items-center justify-center h-32"><Spin /></div>
                ) : topRoomsData.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
                    {language === 'vi' ? 'Chưa có dữ liệu' : 'No data yet'}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {topRoomsData.map((room, idx) => {
                      const max = topRoomsData[0]?.total || 1;
                      const pct = Math.round((room.total / max) * 100);
                      return (
                        <div key={room.room_id} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-zinc-300' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-400'
                            }`}>{idx + 1}</span>
                            <span className="text-xs flex-1 truncate font-medium text-slate-700 dark:text-zinc-200">{room.room_name}</span>
                            <span className="text-xs font-mono font-bold text-[#1e40af] dark:text-[#0a84ff]">{room.total}</span>
                          </div>
                          <div className="ml-7">
                            <div className="h-1 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                              <div className="h-full rounded-full bg-[#1e40af] dark:bg-[#0a84ff] transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Col>

            {/* Equipment donut (admin sees it here too, manager already has it in KPI) */}
            <Col xs={24} sm={24} lg={6}>
              <div className={card('h-full items-center')}>
                <div className={`${labelClass} mb-2 self-start`}>
                  {language === 'vi' ? 'Thiết bị' : 'Equipment'}
                </div>
                <PieChart width={120} height={100}>
                  <Pie data={[
                    { name: language === 'vi' ? 'Hoạt động' : 'Functional', value: equipmentStats.functional || 0.01, fill: EQUIPMENT_STATUS_CONFIG.FUNCTIONAL.tagColor },
                    { name: language === 'vi' ? 'Đang sửa' : 'Under Repair', value: equipmentStats.underRepair || 0.01, fill: EQUIPMENT_STATUS_CONFIG.UNDER_REPAIR.tagColor },
                    { name: language === 'vi' ? 'Ngừng dùng' : 'Decommissioned', value: equipmentStats.decommissioned || 0.01, fill: EQUIPMENT_STATUS_CONFIG.DECOMMISSIONED.tagColor },
                  ]} cx={56} cy={46} innerRadius={28} outerRadius={44} dataKey="value" strokeWidth={0} />
                  <RechartsTooltip contentStyle={{ backgroundColor: isDark ? '#2c2c2e' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0'}`, borderRadius: 8, fontSize: 12 }} />
                </PieChart>
                <div className="w-full space-y-1.5 mt-1">
                  {[
                    { label: language === 'vi' ? 'Hoạt động' : 'Functional', count: equipmentStats.functional, color: '#52c41a' },
                    { label: language === 'vi' ? 'Đang sửa' : 'Under Repair', count: equipmentStats.underRepair, color: '#faad14' },
                    { label: language === 'vi' ? 'Ngừng dùng' : 'Decommissioned', count: equipmentStats.decommissioned, color: '#ff4d4f' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-400">{item.label}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-600 dark:text-zinc-300">{item.count}</span>
                    </div>
                  ))}
                  <div className="text-[11px] pt-1 border-t border-slate-100 dark:border-white/5 text-slate-400">
                    {language === 'vi' ? 'Tổng' : 'Total'}: <strong className="text-slate-600 dark:text-zinc-200">{equipmentStats.total}</strong>
                  </div>
                </div>
              </div>
            </Col>
          </Row>

          {/* Row 4: On-time rate + Cancel rate */}
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12}>
              <div className={card('justify-between')}>
                <div className="flex items-center justify-between mb-2">
                  <span className={labelClass}>{language === 'vi' ? 'Tỷ lệ check-in đúng giờ' : 'On-Time Check-in Rate'}</span>
                  <RiseOutlined className="text-emerald-500 text-sm" />
                </div>
                <div className="flex items-end gap-3">
                  <span className="text-3xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {statsData ? `${Math.round(statsData.on_time_rate)}%` : '—'}
                  </span>
                  <span className="text-[11px] text-slate-400 mb-1">
                    {language === 'vi' ? 'trong kỳ đã chọn' : 'in selected period'}
                  </span>
                </div>
                <div className="mt-2">
                  <Progress
                    percent={statsData ? Math.round(statsData.on_time_rate) : 0}
                    showInfo={false}
                    strokeColor={isDark ? '#30d158' : '#10b981'}
                    railColor={isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9'}
                    size={['100%', 6]}
                  />
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div className={card('justify-between')}>
                <div className="flex items-center justify-between mb-2">
                  <span className={labelClass}>{language === 'vi' ? 'Tỷ lệ hủy booking' : 'Cancellation Rate'}</span>
                  <FallOutlined className="text-red-400 text-sm" />
                </div>
                <div className="flex items-end gap-3">
                  <span className="text-3xl font-bold font-mono tabular-nums text-red-500 dark:text-red-400">
                    {statsData ? `${Math.round(statsData.cancel_rate)}%` : '—'}
                  </span>
                  <span className="text-[11px] text-slate-400 mb-1">
                    {language === 'vi' ? 'trong kỳ đã chọn' : 'in selected period'}
                  </span>
                </div>
                <div className="mt-2">
                  <Progress
                    percent={statsData ? Math.round(statsData.cancel_rate) : 0}
                    showInfo={false}
                    strokeColor={isDark ? '#ff453a' : '#ef4444'}
                    railColor={isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9'}
                    size={['100%', 6]}
                  />
                </div>
              </div>
            </Col>
          </Row>

          {/* Row 5 (admin only): Users + Audit logs + Policy config */}
          {isAdmin && (
            <Row gutter={[12, 12]}>
              {/* Users widget */}
              <Col xs={24} sm={8}>
                <div className={card('h-full')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <UserOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
                      <span className={labelClass}>{language === 'vi' ? 'Người dùng' : 'Users'}</span>
                    </div>
                    <Button type="link" size="small" onClick={() => navigate('/admin/users')}
                      style={{ padding: 0, fontSize: 11, color: isDark ? '#0a84ff' : '#1e40af' }}
                    >
                      {language === 'vi' ? 'Quản lý' : 'Manage'} <ArrowRightOutlined />
                    </Button>
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-800 dark:text-white mb-3">
                    {userStats.total}
                    <span className="text-xs font-normal text-slate-400 ml-1.5">
                      {language === 'vi' ? 'tài khoản' : 'accounts'}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Employee', count: userStats.employee, color: '#1e40af' },
                      { label: 'Room Manager', count: userStats.manager, color: '#7c3aed' },
                      { label: 'Administrator', count: userStats.admin, color: '#ea580c' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">{item.label}</span>
                        <span className="font-mono font-bold" style={{ color: item.color }}>{item.count}</span>
                      </div>
                    ))}
                    {userStats.suspended > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                        <Badge status="error" />
                        <span className="text-[11px] text-red-500 dark:text-red-400">
                          {userStats.suspended} {language === 'vi' ? 'tài khoản bị khóa' : 'suspended accounts'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Col>

              {/* Recent audit logs */}
              <Col xs={24} sm={8}>
                <div className={card('h-full')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AuditOutlined className="text-amber-500" />
                      <span className={labelClass}>{language === 'vi' ? 'Nhật ký gần đây' : 'Recent Audit Logs'}</span>
                    </div>
                    <Button type="link" size="small" onClick={() => navigate('/admin/audit-logs')}
                      style={{ padding: 0, fontSize: 11, color: isDark ? '#0a84ff' : '#1e40af' }}
                    >
                      {language === 'vi' ? 'Xem tất cả' : 'View all'} <ArrowRightOutlined />
                    </Button>
                  </div>
                  {recentLogs.length === 0 ? (
                    <div className="flex items-center justify-center flex-1 text-slate-400 text-xs">
                      {language === 'vi' ? 'Chưa có log nào' : 'No logs yet'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentLogs.slice(0, 5).map((log) => {
                        const cfg = ACTION_TAG_CONFIG[log.action_type];
                        return (
                          <div key={log.id} className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {cfg && (
                                  <Tag color={cfg.color} style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', margin: 0 }}>
                                    {language === 'vi' ? cfg.labelVi : cfg.labelEn}
                                  </Tag>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {log.actor_name}
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0 mt-0.5">
                              {dayjs(log.timestamp).format('HH:mm DD/MM')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Col>

              {/* Policy config */}
              <Col xs={24} sm={8}>
                <div className={card('h-full')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <SettingOutlined className="text-slate-500" />
                      <span className={labelClass}>{language === 'vi' ? 'Cấu hình hiện tại' : 'Current Config'}</span>
                    </div>
                    <Button type="link" size="small" onClick={() => navigate('/admin/settings')}
                      style={{ padding: 0, fontSize: 11, color: isDark ? '#0a84ff' : '#1e40af' }}
                    >
                      {language === 'vi' ? 'Chỉnh sửa' : 'Edit'} <ArrowRightOutlined />
                    </Button>
                  </div>
                  {policyConfig ? (
                    <div className="space-y-1.5 text-xs">
                      {[
                        {
                          label: language === 'vi' ? 'Đặt trước tối đa' : 'Max advance',
                          value: `${policyConfig.max_advance_days} ${language === 'vi' ? 'ngày' : 'days'}`,
                        },
                        {
                          label: language === 'vi' ? 'Thời lượng tối đa' : 'Max duration',
                          value: `${policyConfig.max_duration_minutes} ${language === 'vi' ? 'phút' : 'min'}`,
                        },
                        {
                          label: language === 'vi' ? 'Thời lượng tối thiểu' : 'Min duration',
                          value: `${policyConfig.min_duration_minutes} ${language === 'vi' ? 'phút' : 'min'}`,
                        },
                        {
                          label: language === 'vi' ? 'Cửa sổ check-in' : 'Check-in window',
                          value: `±${policyConfig.check_in_window_minutes} ${language === 'vi' ? 'phút' : 'min'}`,
                        },
                        {
                          label: language === 'vi' ? 'Hủy tự động' : 'Auto-release',
                          value: policyConfig.enable_auto_release_no_show
                            ? `${policyConfig.auto_release_grace_minutes} ${language === 'vi' ? 'phút' : 'min'}`
                            : (language === 'vi' ? 'Tắt' : 'Off'),
                        },
                        {
                          label: language === 'vi' ? 'Buffer giữa các họp' : 'Buffer between',
                          value: `${policyConfig.buffer_minutes_between_meetings} ${language === 'vi' ? 'phút' : 'min'}`,
                        },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50 dark:border-white/5 last:border-0">
                          <span className="text-slate-500 dark:text-slate-400">{item.label}</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-zinc-200 shrink-0">{item.value}</span>
                        </div>
                      ))}
                      <div className="text-[10px] text-slate-400 pt-1">
                        {language === 'vi' ? 'Cập nhật bởi' : 'Updated by'}: {policyConfig.updated_by_name}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center flex-1"><Spin size="small" /></div>
                  )}
                </div>
              </Col>
            </Row>
          )}
        </>
      )}

      {/* ── BOOKING CALENDAR ──────────────────────────────────────────────────── */}
      <BookingCalendar
        bookings={bookings}
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

      <BookingPreviewModal
        booking={previewBooking}
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        onActionClick={(b) => {
          setPreviewModalOpen(false);
          navigate(`/rooms/${b.room_id}/book`);
        }}
      />
    </div>
  );
};
