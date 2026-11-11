import React, { useState, useEffect, useMemo } from 'react';
import {
  Tabs,
  Table,
  DatePicker,
  Select,
  Input,
  Button,
  Row,
  Col,
  Statistic,
  Radio,
  Tag,
  Typography,
  Space,
  App,
  Pagination,
  Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TrophyOutlined,
  ReloadOutlined,
  FilterOutlined,
  ClockCircleOutlined,
  UserOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Booking, Room, BookingStatus, BOOKING_STATUS_CONFIG, getBookingStatusLabel } from '../types';
import { getBookings, getRooms } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useBreakpoint } from '../hooks/useBreakpoint';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: '#1e5bef',
  CHECKED_IN: '#52c41a',
  CANCELLED: '#ff4d4f',
};

export const ReportsPage: React.FC = () => {
  const { isDark } = useTheme();
  const { t, language } = useLanguage();
  const { isMobile } = useBreakpoint();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeTab, setActiveTab] = useState<string>('stats');

  // Filter states for History Table
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'ALL'>('ALL');
  const [roomFilter, setRoomFilter] = useState<number | 'ALL'>('ALL');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  // Mobile pagination
  const [mobilePage, setMobilePage] = useState(1);
  const mobilePageSize = 6;

  // Time range for Stats tab ('7days' | '30days' | 'quarter')
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | 'quarter'>('7days');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bookingsRes, roomsRes] = await Promise.all([
        getBookings(),
        getRooms(),
      ]);
      setBookings(bookingsRes.items);
      setRooms(roomsRes.items);
    } catch (err: any) {
      message.error(err.message || (language === 'vi' ? 'Lỗi khi tải dữ liệu báo cáo' : 'Error loading report data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered bookings for History tab
  const historyBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchRoom = (b.room_name || '').toLowerCase().includes(q);
        const matchUser = (b.user_name || '').toLowerCase().includes(q) || (b.user_email || '').toLowerCase().includes(q);
        const matchPurpose = (b.purpose || '').toLowerCase().includes(q);
        if (!matchRoom && !matchUser && !matchPurpose) return false;
      }

      // Status
      if (statusFilter !== 'ALL' && b.status !== statusFilter) {
        return false;
      }

      // Room
      if (roomFilter !== 'ALL' && b.room_id !== roomFilter) {
        return false;
      }

      // Date range
      if (dateRange && dateRange[0] && dateRange[1]) {
        const bStart = dayjs(b.start_at);
        const startDay = dateRange[0].startOf('day');
        const endDay = dateRange[1].endOf('day');
        if (bStart.isBefore(startDay) || bStart.isAfter(endDay)) {
          return false;
        }
      }

      return true;
    });
  }, [bookings, searchQuery, statusFilter, roomFilter, dateRange]);

  // Bookings filtered by timeRange for Stats Tab
  const statsBookings = useMemo(() => {
    const now = dayjs();
    let daysAgo = 7;
    if (timeRange === '30days') daysAgo = 30;
    if (timeRange === 'quarter') daysAgo = 90;

    const threshold = now.subtract(daysAgo, 'day').startOf('day');
    return bookings.filter((b) => dayjs(b.start_at).isAfter(threshold));
  }, [bookings, timeRange]);

  // Aggregate KPI metrics for Stats Tab
  const statsMetrics = useMemo(() => {
    const total = statsBookings.length;
    const checkedIn = statsBookings.filter((b) => b.status === 'CHECKED_IN').length;
    const cancelled = statsBookings.filter((b) => b.status === 'CANCELLED').length;
    const confirmed = statsBookings.filter((b) => b.status === 'CONFIRMED').length;

    const onTimeRate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
    const cancelRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;

    const roomCounts: Record<string, number> = {};
    statsBookings.forEach((b) => {
      const roomKey = b.room_name || (language === 'vi' ? 'Phòng họp' : 'Meeting Room');
      roomCounts[roomKey] = (roomCounts[roomKey] || 0) + 1;
    });

    let topRoomName = t.noDataAvailable;
    let maxCount = 0;
    Object.entries(roomCounts).forEach(([name, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topRoomName = `${name} (${count} ${language === 'vi' ? 'lượt' : 'times'})`;
      }
    });

    return {
      totalBookings: total,
      checkedIn,
      cancelled,
      confirmed,
      onTimeRate,
      cancelRate,
      topRoomName,
    };
  }, [statsBookings, language, t]);

  // Chart 1: Daily booking distribution (Bar Chart)
  const chartDailyData = useMemo(() => {
    const daysMap: Record<string, { confirmed: number; checkedIn: number; cancelled: number }> = {};

    for (let i = 6; i >= 0; i--) {
      const d = dayjs().subtract(i, 'day').format('DD/MM');
      daysMap[d] = { confirmed: 0, checkedIn: 0, cancelled: 0 };
    }

    statsBookings.forEach((b) => {
      const d = dayjs(b.start_at).format('DD/MM');
      if (daysMap[d]) {
        if (b.status === 'CONFIRMED') daysMap[d].confirmed += 1;
        if (b.status === 'CHECKED_IN') daysMap[d].checkedIn += 1;
        if (b.status === 'CANCELLED') daysMap[d].cancelled += 1;
      }
    });

    return Object.entries(daysMap).map(([name, data]) => ({
      name,
      [t.barConfirmed]: data.confirmed,
      [t.barCheckedIn]: data.checkedIn,
      [t.barCancelled]: data.cancelled,
    }));
  }, [statsBookings, t]);

  // Chart 2: Status distribution (Pie Chart)
  const chartStatusData = useMemo(() => {
    const confirmed = statsBookings.filter((b) => b.status === 'CONFIRMED').length;
    const checkedIn = statsBookings.filter((b) => b.status === 'CHECKED_IN').length;
    const cancelled = statsBookings.filter((b) => b.status === 'CANCELLED').length;

    return [
      { name: t.barConfirmed, value: confirmed || 3, color: '#1e5bef' },
      { name: t.barCheckedIn, value: checkedIn || 4, color: '#52c41a' },
      { name: t.barCancelled, value: cancelled || 1, color: '#ff4d4f' },
    ];
  }, [statsBookings, t]);

  // Chart 3: Top 5 most booked rooms (Horizontal Bar Chart)
  const chartTopRoomsData = useMemo(() => {
    const counts: Record<string, number> = {};
    rooms.forEach((r) => {
      counts[r.name] = 0;
    });

    statsBookings.forEach((b) => {
      const roomKey = b.room_name || (language === 'vi' ? 'Phòng họp' : 'Meeting Room');
      counts[roomKey] = (counts[roomKey] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([room, count]) => ({ room, count, [t.metricBookingsCount]: count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [rooms, statsBookings, t]);

  // History table columns
  const historyColumns: ColumnsType<Booking> = [
    {
      title: t.colId,
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (val) => <span className="font-mono text-slate-400">#{val}</span>,
    },
    {
      title: t.colRoom,
      dataIndex: 'room_name',
      key: 'room_name',
      sorter: (a, b) => (a.room_name || '').localeCompare(b.room_name || ''),
      render: (text) => <strong className="text-sm">{text}</strong>,
    },
    {
      title: t.summaryOrganizer,
      key: 'user',
      render: (_, record) => (
        <div>
          <div className="font-medium text-xs sm:text-sm">{record.user_name || (language === 'vi' ? 'Nhân viên' : 'Staff')}</div>
          <div className="text-[11px] text-slate-400">{record.user_email}</div>
        </div>
      ),
    },
    {
      title: t.fieldPurpose,
      dataIndex: 'purpose',
      key: 'purpose',
      ellipsis: true,
      render: (val) => <span className="text-xs">{val || (language === 'vi' ? 'Họp nội bộ' : 'Internal Meeting')}</span>,
    },
    {
      title: t.colTime,
      key: 'time',
      sorter: (a, b) => dayjs(a.start_at).valueOf() - dayjs(b.start_at).valueOf(),
      render: (_, record) => (
        <div className="font-mono text-xs tabular-nums">
          <div>{dayjs(record.start_at).format('DD/MM/YYYY')}</div>
          <div className="text-slate-400">
            {dayjs(record.start_at).format('HH:mm')} - {dayjs(record.end_at).format('HH:mm')}
          </div>
        </div>
      ),
    },
    {
      title: t.colStatus,
      dataIndex: 'status',
      key: 'status',
      render: (status: BookingStatus) => {
        const cfg = BOOKING_STATUS_CONFIG[status];
        return <Tag color={cfg?.color || 'default'}>{getBookingStatusLabel(status, language)}</Tag>;
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700, color: isDark ? '#ffffff' : '#141b54' }}>
            {t.reportsTitle}
          </Title>
          <Text type="secondary" style={{ fontSize: 13, color: isDark ? '#8e8e93' : undefined }}>
            {t.reportsSubtitle}
          </Text>
        </div>

        <Button icon={<ReloadOutlined />} onClick={fetchData} style={{ borderRadius: 8 }}>
          {t.refreshData}
        </Button>
      </div>

      <div className={`p-4 sm:p-5 rounded-2xl border transition-colors ${
        isDark ? 'bg-[#1c1c1e] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'stats', label: t.tabReportsCharts },
            { key: 'history', label: t.tabCompanyHistory },
          ]}
        />

        {activeTab === 'stats' && (
          <div className="space-y-5 pt-2">
            {/* Time Filter Radio Group */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-100 dark:border-white/10">
              <span className="font-semibold text-xs sm:text-sm text-slate-400">{t.timeRangeLabel}</span>
              <Radio.Group
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                buttonStyle="solid"
                size="small"
              >
                <Radio.Button value="7days">{t.range7Days}</Radio.Button>
                <Radio.Button value="30days">{t.range30Days}</Radio.Button>
                <Radio.Button value="quarter">{t.rangeQuarter}</Radio.Button>
              </Radio.Group>
            </div>

            {/* Stat Cards Row */}
            <Row gutter={[12, 12]}>
              <Col xs={12} sm={12} lg={6}>
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#242426] border-white/15' : 'bg-slate-50 border-slate-200'}`}>
                  <Statistic
                    title={<span className="text-[11px] uppercase text-slate-400 dark:text-zinc-400 font-semibold tracking-wider">{t.kpiTotalBookings}</span>}
                    value={statsMetrics.totalBookings}
                    valueStyle={{ color: '#00c2e8', fontWeight: 700, fontSize: '22px' }}
                    prefix={<CalendarOutlined style={{ fontSize: 16, marginRight: 6, color: '#00c2e8' }} />}
                  />
                  <div className="text-[11px] text-slate-400 dark:text-zinc-400 mt-1 truncate">{t.kpiTotalBookingsSub}</div>
                </div>
              </Col>

              <Col xs={12} sm={12} lg={6}>
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#242426] border-white/15' : 'bg-slate-50 border-slate-200'}`}>
                  <Statistic
                    title={<span className="text-[11px] uppercase text-slate-400 dark:text-zinc-400 font-semibold tracking-wider">{t.kpiOnTimeRate}</span>}
                    value={statsMetrics.onTimeRate}
                    suffix="%"
                    valueStyle={{ color: '#30d158', fontWeight: 700, fontSize: '22px' }}
                    prefix={<CheckCircleOutlined style={{ fontSize: 16, marginRight: 6, color: '#30d158' }} />}
                  />
                  <div className="text-[11px] text-slate-400 dark:text-zinc-400 mt-1 truncate">{t.kpiOnTimeRateSub}</div>
                </div>
              </Col>

              <Col xs={12} sm={12} lg={6}>
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#242426] border-white/15' : 'bg-slate-50 border-slate-200'}`}>
                  <Statistic
                    title={<span className="text-[11px] uppercase text-slate-400 dark:text-zinc-400 font-semibold tracking-wider">{t.kpiCancelRate}</span>}
                    value={statsMetrics.cancelRate}
                    suffix="%"
                    valueStyle={{ color: '#ff453a', fontWeight: 700, fontSize: '22px' }}
                    prefix={<CloseCircleOutlined style={{ fontSize: 16, marginRight: 6, color: '#ff453a' }} />}
                  />
                  <div className="text-[11px] text-slate-400 dark:text-zinc-400 mt-1 truncate">{t.kpiCancelRateSub}</div>
                </div>
              </Col>

              <Col xs={12} sm={12} lg={6}>
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#242426] border-white/15' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-[11px] uppercase text-slate-400 dark:text-zinc-400 font-semibold tracking-wider mb-1">
                    {t.kpiMostPopularRoom}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <TrophyOutlined style={{ fontSize: 16, color: '#ffd60a' }} />
                    <span className="font-bold text-sm truncate">
                      {statsMetrics.topRoomName}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-zinc-400 mt-1 truncate">{t.kpiMostPopularRoomSub}</div>
                </div>
              </Col>
            </Row>

            {/* Charts Row */}
            <Row gutter={[16, 16]}>
              {/* Chart 1: Bar Chart */}
              <Col xs={24} lg={12}>
                <div className={`p-4 rounded-xl border h-full ${isDark ? 'bg-[#242426] border-white/15' : 'bg-white border-slate-200'}`}>
                  <span className="font-bold text-sm block mb-3">{t.chartDailyTitle}</span>
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartDailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255, 255, 255, 0.10)' : '#f0f0f0'} />
                        <XAxis dataKey="name" stroke={isDark ? '#a1a1a6' : '#64748b'} fontSize={11} />
                        <YAxis stroke={isDark ? '#a1a1a6' : '#64748b'} fontSize={11} allowDecimals={false} />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: isDark ? '#2c2c2e' : '#ffffff',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : '#e2e8f0',
                            color: isDark ? '#ffffff' : '#141b54',
                            borderRadius: 8,
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
                            fontSize: 12,
                          }}
                          itemStyle={{ color: isDark ? '#ffffff' : '#141b54' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: isDark ? '#a1a1a6' : '#64748b' }} />
                        <Bar dataKey={t.barConfirmed} stackId="a" fill="#0a84ff" />
                        <Bar dataKey={t.barCheckedIn} stackId="a" fill="#30d158" />
                        <Bar dataKey={t.barCancelled} stackId="a" fill="#ff453a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Col>

              {/* Chart 2: Pie Chart */}
              <Col xs={24} lg={12}>
                <div className={`p-4 rounded-xl border h-full ${isDark ? 'bg-[#242426] border-white/15' : 'bg-white border-slate-200'}`}>
                  <span className="font-bold text-sm block mb-3">{t.chartStatusTitle}</span>
                  <div className="h-[260px] w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartStatusData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          innerRadius={45}
                          paddingAngle={3}
                          label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                          labelLine={false}
                        >
                          {chartStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: isDark ? '#2c2c2e' : '#ffffff',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : '#e2e8f0',
                            color: isDark ? '#ffffff' : '#141b54',
                            borderRadius: 8,
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
                            fontSize: 12,
                          }}
                          itemStyle={{ color: isDark ? '#ffffff' : '#141b54' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, color: isDark ? '#a1a1a6' : '#64748b' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Col>

              {/* Chart 3: Top 5 rooms */}
              <Col xs={24}>
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#242426] border-white/15' : 'bg-white border-slate-200'}`}>
                  <span className="font-bold text-sm block mb-3">{t.chartTopRoomsTitle}</span>
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartTopRoomsData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 30, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? 'rgba(255, 255, 255, 0.10)' : '#f0f0f0'} />
                        <XAxis type="number" stroke={isDark ? '#a1a1a6' : '#64748b'} fontSize={11} allowDecimals={false} />
                        <YAxis dataKey="room" type="category" stroke={isDark ? '#a1a1a6' : '#64748b'} fontSize={11} width={130} />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: isDark ? '#2c2c2e' : '#ffffff',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : '#e2e8f0',
                            color: isDark ? '#ffffff' : '#141b54',
                            borderRadius: 8,
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
                            fontSize: 12,
                          }}
                          itemStyle={{ color: isDark ? '#ffffff' : '#141b54' }}
                        />
                        <Bar dataKey={t.metricBookingsCount} fill="#00c2e8" radius={[0, 6, 6, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4 pt-2">
            {/* Filter Bar */}
            <Row gutter={[10, 10]} align="middle">
              <Col xs={24} sm={12} md={6}>
                <Input
                  placeholder={t.filterHistorySearch}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  prefix={<SearchOutlined className="text-slate-400" />}
                />
              </Col>

              <Col xs={12} sm={6} md={5}>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'ALL', label: t.allStatuses },
                    { value: 'CONFIRMED', label: t.statusConfirmed },
                    { value: 'CHECKED_IN', label: t.statusCheckedIn },
                    { value: 'CANCELLED', label: t.statusCancelled },
                  ]}
                />
              </Col>

              <Col xs={12} sm={6} md={5}>
                <Select
                  value={roomFilter}
                  onChange={setRoomFilter}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'ALL', label: t.allMeetingRoomsOption },
                    ...rooms.map((r) => ({ value: r.id, label: r.name })),
                  ]}
                />
              </Col>

              <Col xs={24} sm={12} md={8}>
                <RangePicker
                  style={{ width: '100%' }}
                  value={dateRange}
                  onChange={(val) => setDateRange(val as any)}
                  format="DD/MM/YYYY"
                />
              </Col>
            </Row>

            {/* Content: Mobile Cards (< 768px) vs Desktop Table (>= 768px) */}
            {isMobile ? (
              <div className="space-y-3">
                {historyBookings.length === 0 ? (
                  <div
                    className={`p-8 rounded-xl border text-center ${
                      isDark ? 'border-white/10 bg-[#1c1c1e]' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <Empty
                      description={
                        <span className="text-slate-500">
                          {language === 'vi' ? 'Không tìm thấy lịch họp phù hợp' : 'No bookings found'}
                        </span>
                      }
                    />
                  </div>
                ) : (
                  historyBookings
                    .slice((mobilePage - 1) * mobilePageSize, mobilePage * mobilePageSize)
                    .map((b) => {
                      const cfg = BOOKING_STATUS_CONFIG[b.status];
                      return (
                        <div
                          key={b.id}
                          className={`p-4 rounded-xl border transition-colors space-y-2.5 ${
                            isDark ? 'bg-[#242426] border-white/10' : 'bg-white border-slate-200 shadow-2xs'
                          }`}
                        >
                          {/* Top row: Room & Status */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-bold text-sm block text-slate-800 dark:text-white">
                                {b.room_name || (language === 'vi' ? 'Phòng họp' : 'Meeting Room')}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                                {b.purpose || (language === 'vi' ? 'Họp nội bộ' : 'Internal Meeting')}
                              </span>
                            </div>
                            <Tag color={cfg?.color || 'default'} className="m-0 font-medium text-xs">
                              {getBookingStatusLabel(b.status, language)}
                            </Tag>
                          </div>

                          {/* Time block */}
                          <div
                            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between font-mono tabular-nums ${
                              isDark
                                ? 'bg-[#1c1c1e] border-white/10 text-cyan-400'
                                : 'bg-blue-50/60 border-blue-100 text-[#1e40af]'
                            }`}
                          >
                            <span className="flex items-center gap-1.5 font-medium">
                              <ClockCircleOutlined />
                              {dayjs(b.start_at).format('HH:mm')} - {dayjs(b.end_at).format('HH:mm')}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {dayjs(b.start_at).format('DD/MM/YYYY')}
                            </span>
                          </div>

                          {/* Organizer & Attendees */}
                          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-100 dark:border-white/10">
                            <div className="flex items-center gap-1.5 truncate max-w-[220px]">
                              <UserOutlined className="text-slate-400" />
                              <span className="font-medium truncate">{b.user_name || 'Staff'}</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-500 shrink-0">
                              <TeamOutlined className="text-slate-400" />
                              <span>
                                {b.num_attendees} {t.peopleUnit}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}

                {/* Mobile Pagination */}
                {historyBookings.length > mobilePageSize && (
                  <div className="flex justify-center pt-2">
                    <Pagination
                      size="small"
                      current={mobilePage}
                      pageSize={mobilePageSize}
                      total={historyBookings.length}
                      onChange={setMobilePage}
                      showSizeChanger={false}
                    />
                  </div>
                )}
              </div>
            ) : (
              /* Desktop Table */
              <div
                className={`rounded-xl border overflow-hidden ${
                  isDark ? 'border-white/10 bg-[#1c1c1e]' : 'border-slate-200 bg-white'
                }`}
              >
                <Table
                  columns={historyColumns}
                  dataSource={historyBookings}
                  rowKey="id"
                  loading={loading}
                  scroll={{ x: 750 }}
                  pagination={{
                    pageSize: 8,
                    showTotal: (total) =>
                      language === 'vi' ? `Tổng cộng ${total} lượt đặt` : `Total ${total} bookings`,
                    showSizeChanger: true,
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
