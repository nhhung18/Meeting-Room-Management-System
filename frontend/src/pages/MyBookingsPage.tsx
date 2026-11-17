import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Tabs,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Empty,
  Tooltip,
  Descriptions,
  App,
  Modal,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  PlusOutlined,
  DownOutlined,
  UpOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Booking, BookingStatus, BOOKING_STATUS_CONFIG, getBookingStatusLabel } from '../types';
import { getBookings, cancelBooking, checkInBooking, isCheckInEligible } from '../api/client';
import { ApiErrorState } from '../components/ApiErrorState';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useBreakpoint } from '../hooks/useBreakpoint';

const { Title, Text } = Typography;

export const MyBookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { t, language } = useLanguage();
  const { isMobile } = useBreakpoint();
  const { message, modal } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number; detail: string } | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [expandedMobileIds, setExpandedMobileIds] = useState<number[]>([]);

  // Pop-up modal state for meeting details
  const [selectedBookingForModal, setSelectedBookingForModal] = useState<Booking | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const fetchUserBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getBookings(
        user?.role === 'ADMINISTRATOR' ? {} : { userId: user?.id }
      );
      setBookings(res.items);
    } catch (err: any) {
      setError({
        status: err.status ?? 0,
        detail: err.detail || err.message || (language === 'vi' ? 'Không thể tải danh sách booking' : 'Failed to load bookings list'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserBookings();
  }, [user]);

  // Tab filtering
  const filteredBookings = useMemo(() => {
    const now = dayjs();
    return bookings.filter((b) => {
      if (activeTab === 'ALL') return true;
      if (activeTab === 'UPCOMING') {
        return b.status === 'CONFIRMED' && dayjs(b.end_at).isAfter(now);
      }
      if (activeTab === 'CHECKED_IN') return b.status === 'CHECKED_IN';
      if (activeTab === 'CANCELLED') return b.status === 'CANCELLED';
      return true;
    });
  }, [bookings, activeTab]);

  // Check-in action handler
  const handleCheckIn = async (booking: Booking) => {
    try {
      setActionLoadingId(booking.id);
      await checkInBooking(booking.id);
      message.success(
        language === 'vi'
          ? `Đã check-in thành công phòng ${booking.room_name}`
          : `Successfully checked into ${booking.room_name}`
      );
      await fetchUserBookings();
    } catch (err: any) {
      if (err.status === 400 || err.message?.includes('400')) {
        message.warning(t.checkInWindowHint);
      } else {
        message.error(err.message || t.checkInFailed);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Cancel action handler with modal confirmation
  const handleCancel = (booking: Booking) => {
    modal.confirm({
      centered: true,
      wrapClassName: 'ant-modal-centered',
      title: t.cancelBookingConfirmTitle,
      icon: <ExclamationCircleOutlined style={{ color: '#ef4444' }} />,
      content: (
        <div>
          <p>
            {language === 'vi' ? (
              <>
                Bạn có chắc chắn muốn hủy lịch họp phòng <strong>{booking.room_name}</strong> vào{' '}
                <strong>{dayjs(booking.start_at).format('HH:mm DD/MM/YYYY')}</strong>?
              </>
            ) : (
              <>
                Are you sure you want to cancel the booking for <strong>{booking.room_name}</strong> on{' '}
                <strong>{dayjs(booking.start_at).format('HH:mm DD/MM/YYYY')}</strong>?
              </>
            )}
          </p>
          <p className="text-xs text-slate-400 mt-2">
            {t.cancelBookingConfirmWarning}
          </p>
        </div>
      ),
      okText: t.confirmCancelBtn,
      okType: 'danger',
      cancelText: t.keepBookingBtn,
      onOk: async () => {
        try {
          setActionLoadingId(booking.id);
          await cancelBooking(booking.id);
          message.success(t.cancelBookingSuccess);
          await fetchUserBookings();
        } catch (err: any) {
          message.error(err.message || t.cancelBookingError);
        } finally {
          setActionLoadingId(null);
        }
      },
    });
  };

  const toggleMobileExpand = (id: number) => {
    setExpandedMobileIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Expandable row render for desktop table
  const expandedRowRender = (record: Booking) => {
    return (
      <div className={`p-4 rounded-xl border space-y-3 ${
        isDark ? 'bg-[#242426] border-white/10 text-zinc-300' : 'bg-slate-50 border-slate-200'
      }`}>
        <Descriptions size="small" column={3} title={<span className="text-xs font-bold uppercase tracking-wider text-[#00c2e8]">{t.meetingDetailHeader} #{record.id}</span>}>
          <Descriptions.Item label={t.meetingOrganizerLabel}>{record.user_name || (language === 'vi' ? 'Nhân viên' : 'Staff')} ({record.user_email})</Descriptions.Item>
          <Descriptions.Item label={t.createdAtLabel}>{dayjs(record.created_at).format('HH:mm DD/MM/YYYY')}</Descriptions.Item>
          <Descriptions.Item label={t.actualCheckInLabel}>
            {record.checked_in_at ? (
              <span className="text-emerald-500 font-medium">
                {dayjs(record.checked_in_at).format('HH:mm:ss DD/MM/YYYY')}
              </span>
            ) : (
              <span className="text-slate-400">{t.notYetCheckedIn}</span>
            )}
          </Descriptions.Item>
          <Descriptions.Item label={t.fieldPurpose} span={2}>{record.purpose || (language === 'vi' ? 'Họp nội bộ' : 'Internal Meeting')}</Descriptions.Item>
          <Descriptions.Item label={t.autoCancelLabel}>
            {record.auto_cancelled_at ? (
              <span className="text-rose-400">{dayjs(record.auto_cancelled_at).format('HH:mm DD/MM')}</span>
            ) : (
              t.noValue
            )}
          </Descriptions.Item>
        </Descriptions>

        <div>
          <span className="text-xs font-semibold text-slate-400 block mb-1">
            {t.attendeesListLabel} ({record.attendees.length}):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {record.attendees.map((att) => (
              <span
                key={att.id}
                className={`text-xs px-2 py-0.5 rounded border ${
                  isDark ? 'bg-white/5 border-white/10 text-zinc-200' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <UserOutlined className="mr-1 text-[#00c2e8]" />
                {att.name} ({att.attendee_email})
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Table columns for Desktop view
  const columns: ColumnsType<Booking> = [
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
      render: (text, record) => (
        <div>
          <span
            className="font-bold text-sm hover:text-[#00c2e8] cursor-pointer block"
            onClick={() => navigate(`/rooms/${record.room_id}`)}
          >
            {text}
          </span>
          <span className="text-xs text-slate-400 line-clamp-1">
            {record.purpose || (language === 'vi' ? 'Họp nội bộ' : 'Internal Meeting')}
          </span>
        </div>
      ),
    },
    {
      title: t.colTime,
      key: 'time',
      width: 220,
      sorter: (a, b) => dayjs(a.start_at).valueOf() - dayjs(b.start_at).valueOf(),
      render: (_, record) => {
        return (
          <div className="space-y-0.5">
            <div className="font-mono font-semibold text-xs text-[#1e40af] dark:text-[#0a84ff] tabular-nums">
              <ClockCircleOutlined className="mr-1" />
              {dayjs(record.start_at).format('HH:mm')} - {dayjs(record.end_at).format('HH:mm')}
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              {dayjs(record.start_at).format('DD/MM/YYYY')}
            </div>
          </div>
        );
      },
    },
    {
      title: t.colAttendees,
      dataIndex: 'num_attendees',
      key: 'num_attendees',
      width: 110,
      render: (val) => (
        <span className="font-mono tabular-nums text-xs">
          <TeamOutlined className="mr-1 text-slate-400" />
          {val} {t.peopleUnit}
        </span>
      ),
    },
    {
      title: t.colStatus,
      dataIndex: 'status',
      key: 'status',
      width: 140,
      filters: [
        { text: getBookingStatusLabel('CONFIRMED', language), value: 'CONFIRMED' },
        { text: getBookingStatusLabel('CHECKED_IN', language), value: 'CHECKED_IN' },
        { text: getBookingStatusLabel('CANCELLED', language), value: 'CANCELLED' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: BookingStatus) => {
        const config = BOOKING_STATUS_CONFIG[status] || { color: 'default', label: status };
        return <Tag color={config.color}>{getBookingStatusLabel(status, language)}</Tag>;
      },
    },
    {
      title: t.colActions,
      key: 'actions',
      width: 350,
      align: 'right',
      render: (_, record) => {
        const isEligible = isCheckInEligible(record.start_at);
        const isConfirmed = record.status === 'CONFIRMED';
        const isLoading = actionLoadingId === record.id;

        return (
          <div className="flex items-center justify-end gap-2">
            {isConfirmed && (
              <>
                {isEligible ? (
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckOutlined />}
                    loading={isLoading}
                    onClick={() => handleCheckIn(record)}
                    style={{ backgroundColor: '#10b981', borderColor: '#10b981', borderRadius: 6 }}
                  >
                    {t.checkIn}
                  </Button>
                ) : (
                  <Tooltip title={t.checkInWindowHint}>
                    <Button size="small" disabled style={{ borderRadius: 6 }}>
                      {t.actionNotYetTime}
                    </Button>
                  </Tooltip>
                )}

                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/bookings/${record.id}/edit`)}
                  style={{ borderRadius: 6 }}
                >
                  {t.actionEditBooking}
                </Button>

                <Button
                  danger
                  size="small"
                  icon={<CloseOutlined />}
                  loading={isLoading}
                  onClick={() => handleCancel(record)}
                  style={{ borderRadius: 6 }}
                >
                  {t.cancel}
                </Button>
              </>
            )}

            {record.status === 'CHECKED_IN' && (
              <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                <CheckOutlined /> {getBookingStatusLabel('CHECKED_IN', language)}
              </span>
            )}

            {record.status === 'CANCELLED' && (
              <span className="text-xs text-slate-400">{getBookingStatusLabel('CANCELLED', language)}</span>
            )}

            {/* Nút Xem chi tiết nằm bên phải ngoài cùng */}
            <Button
              size="small"
              onClick={() => {
                setSelectedBookingForModal(record);
                setDetailModalOpen(true);
              }}
              style={{
                borderRadius: 6,
                borderColor: isDark ? '#0a84ff' : '#1e40af',
                color: isDark ? '#0a84ff' : '#1e40af',
                fontWeight: 500,
              }}
            >
              {t.viewDetails}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Title level={isMobile ? 4 : 3} style={{ margin: 0, fontWeight: 700, color: isDark ? '#f8fafc' : '#141b54' }}>
            {t.myBookingsTitle}
          </Title>
          <Text type="secondary" style={{ fontSize: 13, color: isDark ? '#94a3b8' : undefined }}>
            {t.myBookingsSubtitle}
          </Text>
        </div>

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/rooms')}
          style={{
            backgroundColor: isDark ? '#0a84ff' : '#1e40af',
            borderColor: isDark ? '#0a84ff' : '#1e40af',
            borderRadius: 8,
            fontWeight: 600,
          }}
          className="self-start sm:self-auto"
        >
          {t.newBooking}
        </Button>
      </div>

      {error ? (
        <ApiErrorState error={error} onRetry={fetchUserBookings} />
      ) : (
        <div className={`p-4 sm:p-5 rounded-2xl border transition-colors ${
          isDark ? 'bg-[#1c1c1e] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-800'
        }`}>
          {/* Tab Filters */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'ALL',
                label: `${t.tabAll} (${bookings.length})`,
              },
              {
                key: 'UPCOMING',
                label: `${t.tabUpcoming} (${
                  bookings.filter((b) => b.status === 'CONFIRMED' && dayjs(b.end_at).isAfter(dayjs())).length
                })`,
              },
              {
                key: 'CHECKED_IN',
                label: `${t.tabCheckedIn} (${bookings.filter((b) => b.status === 'CHECKED_IN').length})`,
              },
              {
                key: 'CANCELLED',
                label: `${t.tabCancelled} (${bookings.filter((b) => b.status === 'CANCELLED').length})`,
              },
            ]}
          />

          {/* Mobile Card List View (< 768px) */}
          {isMobile ? (
            <div className="space-y-2.5 pt-2">
              {filteredBookings.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={language === 'vi' ? t.emptyBookings : 'No bookings found'}
                >
                  <Button type="primary" onClick={() => navigate('/rooms')} style={{ backgroundColor: isDark ? '#0a84ff' : '#1e40af', borderColor: isDark ? '#0a84ff' : '#1e40af' }}>
                    {t.bookNow}
                  </Button>
                </Empty>
              ) : (
              filteredBookings.map((item) => {
                const isEligible = isCheckInEligible(item.start_at);
                const statusCfg = BOOKING_STATUS_CONFIG[item.status];

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition-colors ${
                      isDark ? 'bg-[#242426] border-white/15' : 'bg-slate-50/80 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="font-bold text-sm block">
                          {item.room_name}
                        </span>
                        <span className="text-xs text-slate-400 mt-0.5 block">
                          {item.purpose || (language === 'vi' ? 'Họp nội bộ' : 'Internal Meeting')}
                        </span>
                      </div>
                      <Tag color={statusCfg?.color || 'default'} className="m-0 font-medium">
                        {getBookingStatusLabel(item.status, language)}
                      </Tag>
                    </div>

                    <div className={`p-2.5 rounded-lg border space-y-1 text-xs mb-3 ${
                      isDark ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-slate-100'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-mono font-medium text-[#1e40af] dark:text-[#64d2ff] tabular-nums">
                          <ClockCircleOutlined />
                          {dayjs(item.start_at).format('HH:mm')} - {dayjs(item.end_at).format('HH:mm')}
                        </span>
                        <span className="text-slate-400 font-mono tabular-nums">
                          {dayjs(item.start_at).format('DD/MM/YYYY')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-100 dark:border-white/10">
                        <span>
                          <TeamOutlined className="mr-1" />
                          {item.num_attendees} {t.peopleUnit}
                        </span>
                        <span className="font-mono">#{item.id}</span>
                      </div>
                    </div>

                    {/* Card Actions - Responsive layout preventing overflow */}
                    <div className="pt-2.5 border-t border-slate-100 dark:border-white/10 space-y-2">
                      {item.status === 'CONFIRMED' ? (
                        <div className="space-y-2">
                          {/* Row 1: Check-in / Not yet time + View details */}
                          <div className="flex items-center justify-between gap-2">
                            {isEligible ? (
                              <Button
                                type="primary"
                                size="small"
                                icon={<CheckOutlined />}
                                loading={actionLoadingId === item.id}
                                onClick={() => handleCheckIn(item)}
                                style={{
                                  backgroundColor: '#10b981',
                                  borderColor: '#10b981',
                                  fontSize: 12,
                                  borderRadius: 8,
                                  fontWeight: 600,
                                }}
                              >
                                {t.checkIn}
                              </Button>
                            ) : (
                              <Tooltip title={t.checkInWindowHint}>
                                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
                                  <ClockCircleOutlined />
                                  <span>{t.actionNotYetTime}</span>
                                </span>
                              </Tooltip>
                            )}

                            <Button
                              size="small"
                              onClick={() => {
                                setSelectedBookingForModal(item);
                                setDetailModalOpen(true);
                              }}
                              style={{
                                borderRadius: 8,
                                borderColor: isDark ? '#0a84ff' : '#1e40af',
                                color: isDark ? '#0a84ff' : '#1e40af',
                                fontSize: 12,
                                fontWeight: 500,
                                marginLeft: 'auto',
                              }}
                            >
                              {t.viewDetails} &rarr;
                            </Button>
                          </div>

                          {/* Row 2: Edit & Cancel (50/50 grid, 100% contained within card) */}
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => navigate(`/bookings/${item.id}/edit`)}
                              style={{ borderRadius: 8, fontSize: 12 }}
                              className="w-full flex items-center justify-center font-medium"
                            >
                              {t.actionEditBooking}
                            </Button>

                            <Button
                              danger
                              size="small"
                              icon={<CloseOutlined />}
                              loading={actionLoadingId === item.id}
                              onClick={() => handleCancel(item)}
                              style={{ borderRadius: 8, fontSize: 12 }}
                              className="w-full flex items-center justify-center font-medium"
                            >
                              {t.cancel}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* Checked-in or Cancelled row */
                        <div className="flex items-center justify-between gap-2">
                          {item.status === 'CHECKED_IN' && (
                            <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
                              <CheckOutlined /> {getBookingStatusLabel('CHECKED_IN', language)}
                            </span>
                          )}

                          {item.status === 'CANCELLED' && (
                            <span className="text-xs text-slate-400 font-medium">
                              {getBookingStatusLabel('CANCELLED', language)}
                            </span>
                          )}

                          <Button
                            size="small"
                            onClick={() => {
                              setSelectedBookingForModal(item);
                              setDetailModalOpen(true);
                            }}
                            style={{
                              borderRadius: 8,
                              borderColor: isDark ? '#0a84ff' : '#1e40af',
                              color: isDark ? '#0a84ff' : '#1e40af',
                              fontSize: 12,
                              fontWeight: 500,
                              marginLeft: 'auto',
                            }}
                          >
                            {t.viewDetails} &rarr;
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Desktop Table View */
          <div className="rounded-xl overflow-hidden pt-2">
            <Table
              columns={columns}
              dataSource={filteredBookings}
              rowKey="id"
              loading={loading}
              scroll={{ x: 860 }}
              pagination={{
                pageSize: 8,
                showTotal: (total) => language === 'vi' ? `Tổng cộng ${total} lượt đặt` : `Total ${total} bookings`,
                showSizeChanger: true,
              }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={language === 'vi' ? t.emptyBookings : 'No bookings found'}
                  >
                    <Button type="primary" onClick={() => navigate('/rooms')} style={{ backgroundColor: isDark ? '#0a84ff' : '#1e40af', borderColor: isDark ? '#0a84ff' : '#1e40af' }}>
                      {t.bookNow}
                    </Button>
                  </Empty>
                ),
              }}
            />
          </div>
        )}
      </div>
    )}

      {/* POP-UP MODAL: THÔNG BÁO CHI TIẾT CUỘC HỌP */}
      <Modal
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <CalendarOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
            <span className="font-bold text-base">
              {t.meetingDetailHeader} {selectedBookingForModal ? `#${selectedBookingForModal.id}` : ''}
            </span>
          </div>
        }
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)} style={{ borderRadius: 6 }}>
            {t.close}
          </Button>,
          selectedBookingForModal && selectedBookingForModal.status === 'CONFIRMED' && (
            <Button
              key="cancel"
              danger
              icon={<CloseOutlined />}
              onClick={() => {
                setDetailModalOpen(false);
                handleCancel(selectedBookingForModal);
              }}
              style={{ borderRadius: 6 }}
            >
              {t.cancel}
            </Button>
          ),
          selectedBookingForModal && selectedBookingForModal.status === 'CONFIRMED' && isCheckInEligible(selectedBookingForModal.start_at) && (
            <Button
              key="checkin"
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => {
                setDetailModalOpen(false);
                handleCheckIn(selectedBookingForModal);
              }}
              style={{ backgroundColor: '#30d158', borderColor: '#30d158', borderRadius: 6 }}
            >
              {t.checkInNow}
            </Button>
          ),
        ]}
        width={580}
      >
        {selectedBookingForModal && (
          <div className="flex flex-col gap-4 py-2">
            {/* Header phòng & trạng thái */}
            <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <div className="font-bold text-base text-slate-800 dark:text-white">
                  {selectedBookingForModal.room_name}
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5">
                  <EnvironmentOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
                  <span>{language === 'vi' ? 'Phòng họp BlueOC Tech' : 'BlueOC Tech Meeting Room'}</span>
                </div>
              </div>
              <Tag
                color={BOOKING_STATUS_CONFIG[selectedBookingForModal.status]?.color || 'default'}
                className="font-medium text-xs px-2.5 py-0.5 m-0"
              >
                {getBookingStatusLabel(selectedBookingForModal.status, language)}
              </Tag>
            </div>

            {/* Thông tin chi tiết Descriptions */}
            <Descriptions
              bordered
              size="small"
              column={isMobile ? 1 : 2}
              className="rounded-xl overflow-hidden !m-0"
              style={{ margin: 0 }}
            >
              <Descriptions.Item label={t.meetingTimeLabel} span={isMobile ? 1 : 2}>
                <div className="font-mono font-bold text-black dark:text-white text-xs sm:text-sm">
                  {dayjs(selectedBookingForModal.start_at).format('HH:mm')} - {dayjs(selectedBookingForModal.end_at).format('HH:mm')}
                  <span className="text-slate-500 dark:text-zinc-400 font-normal ml-2">
                    ({dayjs(selectedBookingForModal.start_at).format('DD/MM/YYYY')})
                  </span>
                </div>
              </Descriptions.Item>

              <Descriptions.Item label={t.fieldPurpose} span={isMobile ? 1 : 2}>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {selectedBookingForModal.purpose || (language === 'vi' ? 'Họp nội bộ' : 'Internal Meeting')}
                </span>
              </Descriptions.Item>

              <Descriptions.Item label={t.meetingOrganizerLabel} span={1}>
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedBookingForModal.user_name || (language === 'vi' ? 'Nhân viên' : 'Staff')}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {selectedBookingForModal.user_email}
                  </div>
                </div>
              </Descriptions.Item>

              <Descriptions.Item label={t.createdAtLabel} span={1}>
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                  {dayjs(selectedBookingForModal.created_at).format('HH:mm DD/MM/YYYY')}
                </span>
              </Descriptions.Item>

              <Descriptions.Item label={t.actualCheckInLabel} span={isMobile ? 1 : 2}>
                {selectedBookingForModal.checked_in_at ? (
                  <span className="text-emerald-500 font-semibold text-xs flex items-center gap-1 font-mono">
                    <CheckOutlined /> {dayjs(selectedBookingForModal.checked_in_at).format('HH:mm:ss DD/MM/YYYY')}
                  </span>
                ) : (
                  <span className="text-slate-400 text-xs">
                    {language === 'vi' ? 'Chưa check-in (Khung check-in hợp lệ: ±15 phút trước/sau giờ bắt đầu)' : 'Not checked in yet (Check-in window: ±15m around start time)'}
                  </span>
                )}
              </Descriptions.Item>
            </Descriptions>

            {/* Danh sách người tham gia - Khoảng cách đồng bộ, căn giữa div lớn và các ô tên kéo bằng nhau */}
            <div className={`p-3.5 rounded-xl border w-full mx-auto ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 text-center flex items-center justify-center gap-1.5">
                <TeamOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
                <span>{t.attendeesListLabel} ({selectedBookingForModal.attendees.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto p-0.5 w-full">
                {selectedBookingForModal.attendees.map((att) => (
                  <div
                    key={att.id}
                    className={`text-xs px-3 py-2 rounded-lg border flex items-center gap-2.5 w-full min-w-0 transition-colors ${
                      isDark ? 'bg-[#242426] border-white/15 text-zinc-200' : 'bg-white border-slate-200 text-slate-700 shadow-2xs'
                    }`}
                  >
                    <UserOutlined className="text-[#1e40af] dark:text-[#0a84ff] shrink-0 text-sm" />
                    <div className="min-w-0 flex-1 truncate text-left">
                      <div className="font-medium text-slate-800 dark:text-zinc-100 truncate">{att.name}</div>
                      {att.attendee_email && (
                        <div className="text-[11px] text-slate-400 truncate">{att.attendee_email}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
