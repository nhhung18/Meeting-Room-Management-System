import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Typography,
  Tag,
  Button,
  Space,
  Divider,
  Spin,
  App,
  Segmented,
  Tooltip,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm,
} from 'antd';
import {
  TeamOutlined,
  EnvironmentOutlined,
  UserOutlined,
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
  PlusOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  VideoCameraOutlined,
  AppstoreOutlined,
  BarsOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PictureOutlined,
  ToolOutlined,
  EditOutlined,
  DeleteOutlined,
  BarcodeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import {
  Room,
  Booking,
  ROOM_STATUS_CONFIG,
  BOOKING_STATUS_CONFIG,
  getRoomStatusLabel,
  getBookingStatusLabel,
  getEquipmentLabel,
  EquipmentItem,
  EquipmentStatus,
  EQUIPMENT_STATUS_CONFIG,
  STANDARD_EQUIPMENT,
} from '../types';
import { getRoomById, getBookings, getEquipmentByRoom, getRooms, createEquipment, updateEquipment, deleteEquipment } from '../api/client';
import { ApiErrorState } from '../components/ApiErrorState';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

dayjs.extend(isoWeek);

const { Title, Text, Paragraph } = Typography;

export const RoomDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { t, language } = useLanguage();
  const { isMobile } = useBreakpoint();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number; detail: string } | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Room equipment state
  const [roomEquipments, setRoomEquipments] = useState<EquipmentItem[]>([]);
  const [equipmentModalOpen, setEquipmentModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<EquipmentItem | null>(null);
  const [equipmentSubmitting, setEquipmentSubmitting] = useState(false);
  const [equipForm] = Form.useForm();

  // Selected booking for pop-up detail preview
  const [previewBooking, setPreviewBooking] = useState<Booking | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Weekly calendar anchor date: starts on Sunday to match Google Calendar UI
  const [currentWeekStart, setCurrentWeekStart] = useState<dayjs.Dayjs>(() => {
    // Google Calendar starts on Sunday
    const now = dayjs();
    return now.subtract(now.day(), 'day').startOf('day');
  });

  // Selected day for mobile Day-View
  const [selectedDayStr, setSelectedDayStr] = useState<string>(() =>
    dayjs().format('YYYY-MM-DD')
  );

  // View mode for calendar: 'week' (Google Calendar Grid) or 'day'
  const [calendarViewMode, setCalendarViewMode] = useState<'day' | 'week'>('week');

  const fetchDetail = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [roomData, bookingsData, equipData, allRoomsData] = await Promise.all([
        getRoomById(Number(id)),
        getBookings({ roomId: Number(id) }),
        getEquipmentByRoom(Number(id)),
        getRooms(),
      ]);
      setRoom(roomData);
      setBookings(bookingsData.items);
      setRoomEquipments(equipData);
      setAllRooms(allRoomsData.items);
    } catch (err: any) {
      setError({
        status: err.status ?? 0,
        detail: err.detail || err.message || (language === 'vi' ? 'Không tìm thấy thông tin phòng họp' : 'Failed to load room details'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleOpenAddEquipment = () => {
    setEditingEquipment(null);
    equipForm.resetFields();
    equipForm.setFieldsValue({
      category: STANDARD_EQUIPMENT[0],
      status: 'FUNCTIONAL',
      room_ids: [Number(id)],
    });
    setEquipmentModalOpen(true);
  };

  const handleOpenEditEquipment = (item: EquipmentItem) => {
    setEditingEquipment(item);
    const currentRoomIds = item.room_ids && item.room_ids.length > 0
      ? item.room_ids
      : (item.room_id ? [item.room_id] : [Number(id)]);
    equipForm.setFieldsValue({
      name: item.name,
      category: item.category,
      status: item.status,
      room_ids: currentRoomIds,
      serial_number: item.serial_number || '',
      notes: item.notes || '',
    });
    setEquipmentModalOpen(true);
  };

  const handleDeleteEquipment = async (item: EquipmentItem) => {
    try {
      await deleteEquipment(item.id);
      message.success(t.deleteEquipmentSuccess);
      const refreshed = await getEquipmentByRoom(Number(id));
      setRoomEquipments(refreshed);
    } catch (err: any) {
      message.error(err.message || 'Error deleting equipment');
    }
  };

  const handleSaveEquipment = async () => {
    try {
      const values = await equipForm.validateFields();
      setEquipmentSubmitting(true);

      const selectedRoomIds: number[] = values.room_ids && values.room_ids.length > 0 ? values.room_ids : [Number(id)];
      const selectedRooms = allRooms.filter((r) => selectedRoomIds.includes(r.id));
      const primaryRoom = selectedRooms.find((r) => r.id === Number(id)) || selectedRooms[0];

      if (editingEquipment) {
        await updateEquipment(editingEquipment.id, {
          name: values.name.trim(),
          category: values.category,
          status: values.status,
          room_ids: selectedRoomIds,
          room_names: selectedRooms.map((r) => r.name),
          room_id: primaryRoom ? primaryRoom.id : Number(id),
          room_name: primaryRoom ? primaryRoom.name : room?.name,
          serial_number: values.serial_number?.trim() || undefined,
          notes: values.notes?.trim() || undefined,
        });
        message.success(t.updateEquipmentSuccess);
      } else {
        await createEquipment({
          name: values.name.trim(),
          category: values.category,
          status: values.status,
          room_ids: selectedRoomIds,
          room_names: selectedRooms.map((r) => r.name),
          room_id: primaryRoom ? primaryRoom.id : Number(id),
          room_name: primaryRoom ? primaryRoom.name : room?.name,
          serial_number: values.serial_number?.trim() || undefined,
          notes: values.notes?.trim() || undefined,
        });
        message.success(t.addEquipmentSuccess);
      }
      setEquipmentModalOpen(false);
      const refreshed = await getEquipmentByRoom(Number(id));
      setRoomEquipments(refreshed);
    } catch (err: any) {
      if (!err?.errorFields) {
        message.error(err.message || 'Error saving equipment');
      }
    } finally {
      setEquipmentSubmitting(false);
    }
  };

  // Generate 7 days of the current week (Sun -> Sat like Google Calendar)
  const weekDays = useMemo(() => {
    const dayNames = language === 'vi'
      ? ['CN', 'TH 2', 'TH 3', 'TH 4', 'TH 5', 'TH 6', 'TH 7']
      : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const fullDayNames = language === 'vi'
      ? ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']
      : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return Array.from({ length: 7 }).map((_, idx) => {
      const date = currentWeekStart.add(idx, 'day');
      const dIndex = date.day(); // 0 is Sunday, 1 is Monday...
      return {
        date,
        dateStr: date.format('YYYY-MM-DD'),
        dayName: dayNames[dIndex],
        fullDayName: fullDayNames[dIndex],
        dayNumber: date.format('D'),
        formatted: date.format('DD/MM'),
        isToday: date.isSame(dayjs(), 'day'),
      };
    });
  }, [currentWeekStart, language]);

  // Google Calendar working hours: 07:00 to 22:00 (7 AM - 10 PM)
  const hours = useMemo(() => {
    return [
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
  }, []);

  // Filter bookings for the selected week
  const weekBookings = useMemo(() => {
    const startStr = currentWeekStart.format('YYYY-MM-DD');
    const endStr = currentWeekStart.add(6, 'day').format('YYYY-MM-DD');
    return bookings.filter((b) => {
      const bDate = dayjs(b.start_at).format('YYYY-MM-DD');
      return bDate >= startStr && bDate <= endStr;
    });
  }, [bookings, currentWeekStart]);

  const handlePrevWeek = () => {
    setCurrentWeekStart((prev) => prev.subtract(1, 'week'));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart((prev) => prev.add(1, 'week'));
  };

  const handleCurrentWeek = () => {
    const now = dayjs();
    setCurrentWeekStart(now.subtract(now.day(), 'day').startOf('day'));
  };

  const handleBookSlot = (dateStr: string, timeHour: string) => {
    if (!room || room.status !== 'AVAILABLE') {
      message.warning(t.roomUnderMaintenanceAlert);
      return;
    }
    navigate(`/rooms/${room.id}/book?date=${dateStr}&time=${timeHour}`);
  };

  const handleOpenBookingPreview = (b: Booking, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewBooking(b);
    setPreviewModalOpen(true);
  };

  // Google calendar month/year header display (e.g. Tháng 5, 2025 / May 2025)
  const currentMonthYearLabel = useMemo(() => {
    const midWeekDate = currentWeekStart.add(3, 'day');
    return midWeekDate.format(language === 'vi' ? '[Tháng] M, YYYY' : 'MMMM YYYY');
  }, [currentWeekStart, language]);

  // Current live time for red marker
  const now = dayjs();
  const currentHour = now.hour();
  const currentMinute = now.minute();
  const isCurrentTimeInRange = currentHour >= 7 && currentHour <= 22;

  // Google Calendar palette colors for events
  const getEventBadgeStyle = (b: Booking) => {
    if (b.status === 'CANCELLED') {
      return {
        bg: isDark ? 'bg-white/5 border-white/10 text-zinc-500 line-through' : 'bg-slate-100 border-slate-300 text-slate-500 line-through',
        dot: 'bg-zinc-400',
      };
    }
    if (b.status === 'CHECKED_IN') {
      return {
        bg: isDark ? 'bg-[#30d158]/20 border-[#30d158]/40 text-emerald-200' : 'bg-[#10b981] border-[#059669] text-white',
        dot: 'bg-emerald-300',
      };
    }
    // Confirmed bookings: alternate colors based on id (Apple HIG dynamic vibrancy palette)
    const palettes = [
      { bg: isDark ? 'bg-[#0a84ff]/25 border-[#0a84ff]/40 text-blue-100' : 'bg-[#1e40af] border-[#1d4ed8] text-white', dot: 'bg-sky-300' },
      { bg: isDark ? 'bg-[#bf5af2]/25 border-[#bf5af2]/40 text-purple-100' : 'bg-[#7c3aed] border-[#6d28d9] text-white', dot: 'bg-purple-300' },
      { bg: isDark ? 'bg-[#ff9f0a]/25 border-[#ff9f0a]/40 text-amber-100' : 'bg-[#ea580c] border-[#c2410c] text-white', dot: 'bg-amber-300' },
      { bg: isDark ? 'bg-[#64d2ff]/25 border-[#64d2ff]/40 text-cyan-100' : 'bg-[#0284c7] border-[#0369a1] text-white', dot: 'bg-cyan-300' },
    ];
    return palettes[b.id % palettes.length];
  };

  if (loading) {
    return (
      <div className={`py-24 text-center rounded-2xl border ${isDark ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-slate-200'}`}>
        <Spin size="large" description={t.loadingRooms} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 max-w-full">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/rooms')}
          style={{ paddingLeft: 0, color: isDark ? '#0a84ff' : '#1e40af', fontWeight: 600 }}
        >
          {t.backToRoomList}
        </Button>
        <ApiErrorState error={error} onRetry={fetchDetail} />
      </div>
    );
  }

  if (!room) {
    return (
      <div className={`p-8 rounded-2xl border text-center ${isDark ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-slate-200'}`}>
        <Title level={4} style={{ color: isDark ? '#fff' : undefined }}>{t.noRoomsFound}</Title>
        <Button type="primary" onClick={() => navigate('/rooms')} style={{ backgroundColor: isDark ? '#0a84ff' : '#1e40af', borderColor: isDark ? '#0a84ff' : '#1e40af' }}>
          {t.backToRoomList}
        </Button>
      </div>
    );
  }

  const statusConfig = ROOM_STATUS_CONFIG[room.status];
  const isAvailable = room.status === 'AVAILABLE';

  return (
    <div className="space-y-4 max-w-full">
      {/* Top Breadcrumb / Return */}
      <div className="flex items-center justify-between">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/rooms')}
          style={{ paddingLeft: 0, color: isDark ? '#0a84ff' : '#1e40af', fontWeight: 600 }}
        >
          {t.backToRoomList}
        </Button>

        <span className="text-xs font-mono text-slate-400">
          ID: #{room.id}
        </span>
      </div>

      {/* Top Section - 2 Columns (Room Information) */}
      <Row gutter={[16, 16]}>
        {/* Left: Room Photo Slot */}
        <Col xs={24} md={10}>
          <div className={`w-full aspect-video rounded-2xl border flex flex-col items-center justify-center relative overflow-hidden transition-colors ${
            isDark
              ? 'bg-[#1c1c1e] border-white/10'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-2 ${
              isDark ? 'bg-white/5 text-[#0a84ff] border border-white/10' : 'bg-white text-[#1e40af] shadow-xs'
            }`}>
              <PictureOutlined style={{ fontSize: 26 }} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {room.name}
            </span>
            <span className="text-xs text-slate-400">
              {room.floor || 'Khu hội nghị BlueOC Tech'}
            </span>

            {/* Status overlay tag */}
            <div className="absolute top-3 right-3">
              <Tag color={statusConfig.color} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, margin: 0 }}>
                {getRoomStatusLabel(room.status, language)}
              </Tag>
            </div>
          </div>
        </Col>

        {/* Right: Room Meta & Equipment */}
        <Col xs={24} md={14}>
          <div className={`h-full rounded-2xl border p-5 flex flex-col justify-between transition-colors ${
            isDark ? 'bg-[#1c1c1e] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <Title level={isMobile ? 4 : 3} style={{ margin: 0, fontWeight: 700, color: isDark ? '#ffffff' : '#141b54' }}>
                  {room.name}
                </Title>
              </div>

              {/* Unboxed Metadata */}
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-400 mb-3">
                <span className="flex items-center gap-1 font-mono font-semibold text-[#1e40af] dark:text-[#38bdf8]">
                  <TeamOutlined /> {room.capacity} {t.peopleUnit}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <EnvironmentOutlined /> {room.floor || t.defaultRoomFloor}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <UserOutlined /> {room.owner_id ? t.facilityDept : t.unassigned}
                </span>
              </div>

              <Paragraph className={`text-xs sm:text-sm leading-relaxed mb-3 ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                {room.description || t.defaultRoomDescription}
              </Paragraph>

              <Divider style={{ margin: '10px 0', borderColor: isDark ? '#27272a' : '#e2e8f0' }} />

              {/* Equipment with Tooltip for overflow */}
              <div className="mb-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center justify-between">
                  <span>{t.availableAmenities} ({room.equipment.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {room.equipment.slice(0, 4).map((item, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-0.5 text-xs rounded border ${
                        isDark ? 'bg-[#18181b] border-[#27272a] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {getEquipmentLabel(item, language)}
                    </span>
                  ))}
                  {room.equipment.length > 4 && (
                    <Tooltip
                      title={
                        <div>
                          <div className="font-semibold text-xs mb-1 text-slate-200">{t.otherEquipmentTitle} (+{room.equipment.length - 4}):</div>
                          <div className="flex flex-wrap gap-1">
                            {room.equipment.slice(4).map((eq, idx) => (
                              <span key={idx} className="text-[11px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-100">
                                {getEquipmentLabel(eq, language)}
                              </span>
                            ))}
                          </div>
                        </div>
                      }
                    >
                      <span className="text-xs text-[#1e40af] dark:text-[#0a84ff] font-semibold cursor-pointer px-2 py-0.5 rounded bg-blue-50 dark:bg-white/10">
                        +{room.equipment.length - 4} {t.otherEquipmentCount}
                      </span>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>

            {/* Primary Action Button - Solid Corporate Blue */}
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/10">
              <Button
                type="primary"
                size="large"
                block
                disabled={!isAvailable}
                icon={<CalendarOutlined />}
                onClick={() => navigate(`/rooms/${room.id}/book`)}
                style={{
                  height: 42,
                  backgroundColor: isDark ? '#0a84ff' : '#1e40af',
                  borderColor: isDark ? '#0a84ff' : '#1e40af',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 8,
                }}
              >
                {isAvailable ? t.bookThisRoomNow : t.roomUnderMaintenanceAlert}
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {/* IN-ROOM EQUIPMENT MANAGEMENT SECTION */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-colors ${
        isDark ? 'bg-[#1c1c1e] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <ToolOutlined className="text-[#1e40af] dark:text-[#0a84ff] text-base" />
            <span className="font-bold text-sm sm:text-base text-slate-800 dark:text-white">
              {t.equipmentInRoomTitle}
            </span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-300">
              {roomEquipments.length} {language === 'vi' ? 'thiết bị' : 'devices'}
            </span>
          </div>

          {(user?.role === 'ROOM_MANAGER' || user?.role === 'ADMINISTRATOR') && (
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleOpenAddEquipment}
              style={{
                backgroundColor: isDark ? '#0a84ff' : '#1e40af',
                borderColor: isDark ? '#0a84ff' : '#1e40af',
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              {language === 'vi' ? 'Thêm thiết bị vào phòng' : 'Add Equipment to Room'}
            </Button>
          )}
        </div>

        {roomEquipments.length === 0 ? (
          <div className="text-xs text-slate-400 py-3 text-center">
            {language === 'vi' ? 'Chưa có thiết bị chi tiết nào được phân bổ cho phòng này' : 'No dedicated equipment currently registered in this room'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {roomEquipments.map((item) => {
              const statusCfg = EQUIPMENT_STATUS_CONFIG[item.status];
              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                    isDark ? 'bg-[#242426] border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                        {item.id}
                      </span>
                      <Tag color={statusCfg.color} className="m-0 text-[11px]">
                        {language === 'vi' ? statusCfg.label : statusCfg.labelEn}
                      </Tag>
                    </div>

                    <div className="font-semibold text-xs text-slate-800 dark:text-zinc-100 line-clamp-1 mb-1">
                      {item.name}
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                      <ToolOutlined />
                      <span>{item.category}</span>
                    </div>

                    {item.serial_number && (
                      <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                        <BarcodeOutlined />
                        <span>{item.serial_number}</span>
                      </div>
                    )}

                    {item.room_ids && item.room_ids.length > 1 && (
                      <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-white/10">
                        <Tag color="cyan" className="m-0 text-[10px] font-semibold mb-1">
                          {t.sharedEquipmentBadge}
                        </Tag>
                        <div className="text-[10px] text-slate-400 line-clamp-2">
                          <span>{t.sharedWithRooms}: </span>
                          <span className="text-slate-700 dark:text-zinc-200 font-medium">
                            {(item.room_names || [])
                              .filter((name) => name !== room.name)
                              .join(', ') || `${item.room_ids.length - 1} ${language === 'vi' ? 'phòng khác' : 'other rooms'}`}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {(user?.role === 'ROOM_MANAGER' || user?.role === 'ADMINISTRATOR') && (
                    <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-1.5 mt-2">
                      <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => handleOpenEditEquipment(item)}
                        style={{ fontSize: 11, padding: '0 6px' }}
                      >
                        {language === 'vi' ? 'Sửa' : 'Edit'}
                      </Button>

                      <Popconfirm
                        title={t.deleteEquipmentConfirmTitle}
                        description={t.deleteEquipmentConfirmDesc}
                        okText={t.confirm}
                        cancelText={t.cancel}
                        okType="danger"
                        onConfirm={() => handleDeleteEquipment(item)}
                      >
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          style={{ fontSize: 11, padding: '0 6px' }}
                        />
                      </Popconfirm>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* GOOGLE CALENDAR WEEKLY SCHEDULE VIEW */}
      <div className={`rounded-2xl border transition-colors overflow-hidden ${
        isDark ? 'bg-[#1c1c1e] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        {/* Google Calendar Style Top Control Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-white/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Left: Today, Prev/Next Arrows, Month Year */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Google Calendar 'Today' Button */}
            <button
              type="button"
              onClick={handleCurrentWeek}
              className={`px-3.5 py-1.5 rounded-full border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                isDark
                  ? 'border-white/15 bg-white/5 hover:bg-white/10 text-white'
                  : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700 shadow-2xs'
              }`}
            >
              {t.calendarToday}
            </button>

            {/* Arrows */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevWeek}
                aria-label={t.calendarPrevWeek}
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
                onClick={handleNextWeek}
                aria-label={t.calendarNextWeek}
                className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                  isDark
                    ? 'border-white/15 hover:bg-white/10 text-white'
                    : 'border-transparent hover:bg-slate-100 text-slate-600'
                }`}
              >
                <RightOutlined style={{ fontSize: 13 }} />
              </button>
            </div>

            {/* Month & Year Title */}
            <span className="font-bold text-base sm:text-lg text-slate-800 dark:text-white tracking-tight ml-1">
              {currentMonthYearLabel}
            </span>
          </div>

          {/* Right: View Switcher & Quick Add Button */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            <Segmented
              size="small"
              value={calendarViewMode}
              onChange={(val) => setCalendarViewMode(val as any)}
              options={[
                { label: t.calendarWeekView, value: 'week', icon: <AppstoreOutlined /> },
                { label: t.calendarDayView, value: 'day', icon: <BarsOutlined /> },
              ]}
            />

            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => navigate(`/rooms/${room.id}/book`)}
              style={{
                backgroundColor: isDark ? '#0a84ff' : '#1e40af',
                borderColor: isDark ? '#0a84ff' : '#1e40af',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              {t.calendarNewBooking}
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="px-4 py-2 bg-slate-50/70 dark:bg-[#242426] border-b border-slate-200 dark:border-white/15 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-zinc-300 gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0a84ff] inline-block" />
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
          <span className="text-[11px] text-slate-400 italic">
            {t.calendarSlotBookHint}
          </span>
        </div>

        {/* VIEW 1: GOOGLE CALENDAR WEEK VIEW (Desktop & Tablet) */}
        {calendarViewMode === 'week' ? (
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              {/* Day Headers (CN, TH 2, TH 3, TH 4, TH 5, TH 6, TH 7) */}
              <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-slate-200 dark:border-white/15 bg-white dark:bg-[#1c1c1e] sticky top-0 z-10">
                {/* Time gutter header */}
                <div className="p-2.5 text-center flex flex-col items-center justify-center border-r border-slate-200 dark:border-white/15">
                  <span className="text-[10px] font-mono text-slate-400 font-semibold tracking-wider">
                    GMT+7
                  </span>
                </div>

                {/* 7 Day Columns matching Google Calendar attachment */}
                {weekDays.map((day) => (
                  <div
                    key={day.dateStr}
                    className={`py-2 px-1 text-center border-r border-slate-200 dark:border-white/15 last:border-r-0 ${
                      day.isToday ? 'bg-blue-50/30 dark:bg-white/5' : ''
                    }`}
                  >
                    {/* Day abbreviation */}
                    <div className={`text-[11px] uppercase font-bold tracking-wider mb-1 ${
                      day.isToday
                        ? 'text-[#0a84ff]'
                        : 'text-slate-500 dark:text-zinc-400'
                    }`}>
                      {day.dayName}
                    </div>

                    {/* Google Calendar Blue Circle on Today's Day Number */}
                    {day.isToday ? (
                      <div className="w-9 h-9 rounded-full bg-[#0a84ff] text-white flex items-center justify-center font-bold text-base shadow-sm mx-auto">
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

              {/* Timetable Body (7:00 to 22:00) */}
              <div className="relative">
                {hours.map((hour) => {
                  const hourNum = parseInt(hour.split(':')[0], 10);
                  const isCurrentHourRow = isCurrentTimeInRange && hourNum === currentHour;

                  return (
                    <div
                      key={hour}
                      className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-slate-100 dark:border-white/5 min-h-[58px]"
                    >
                      {/* Left Time Gutter Column */}
                      <div className="text-right pr-3 -mt-2.5 text-[11px] font-mono text-slate-400 select-none border-r border-slate-200 dark:border-white/10 bg-white dark:bg-[#1c1c1e]">
                        {hour}
                      </div>

                      {/* 7 Day Slots for this hour */}
                      {weekDays.map((day) => {
                        const slotBookings = weekBookings.filter((b) => {
                          const bDate = dayjs(b.start_at).format('YYYY-MM-DD');
                          if (bDate !== day.dateStr) return false;
                          const bStartHour = dayjs(b.start_at).hour();
                          const bEndHour = dayjs(b.end_at).hour();
                          return hourNum >= bStartHour && hourNum < Math.max(bStartHour + 1, bEndHour);
                        });

                        const isTodaySlot = day.isToday;

                        return (
                          <div
                            key={day.dateStr + hour}
                            onClick={() => {
                              if (slotBookings.length === 0) {
                                handleBookSlot(day.dateStr, hour);
                              }
                            }}
                            className={`relative border-r border-slate-100 dark:border-white/5 last:border-r-0 p-1 transition-all ${
                              slotBookings.length === 0
                                ? 'hover:bg-blue-50/40 dark:hover:bg-white/5 cursor-pointer group'
                                : ''
                            } ${isTodaySlot ? 'bg-blue-50/10 dark:bg-white/[0.02]' : ''}`}
                          >
                            {/* Live Current Time Red Marker Line */}
                            {isTodaySlot && isCurrentHourRow && (
                              <div
                                className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                                style={{ top: `${(currentMinute / 60) * 100}%` }}
                              >
                                <span className="w-2.5 h-2.5 rounded-full bg-[#ea4335] -ml-1.5 shadow-xs shrink-0" />
                                <span className="h-[2px] bg-[#ea4335] w-full" />
                              </div>
                            )}

                            {/* Render Booking Event Cards */}
                            {slotBookings.map((b) => {
                              const badgeStyle = getEventBadgeStyle(b);
                              const isStartHour = dayjs(b.start_at).hour() === hourNum;

                              if (!isStartHour) {
                                // Continued slot of longer meeting
                                return (
                                  <div
                                    key={b.id}
                                    onClick={(e) => handleOpenBookingPreview(b, e)}
                                    className={`w-full h-full rounded-md px-2 py-1 text-xs border cursor-pointer opacity-90 ${badgeStyle.bg}`}
                                  >
                                    <span className="text-[10px] opacity-80">{t.calendarContinuedMeeting}</span>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={b.id}
                                  onClick={(e) => handleOpenBookingPreview(b, e)}
                                  className={`w-full rounded-md p-1.5 text-xs border shadow-2xs cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${badgeStyle.bg}`}
                                >
                                  <div className="font-bold leading-tight line-clamp-1">
                                    {b.purpose || t.internalWorkMeeting}
                                  </div>
                                  <div className="text-[10px] opacity-90 font-mono mt-0.5">
                                    {dayjs(b.start_at).format('HH:mm')} - {dayjs(b.end_at).format('HH:mm')}
                                  </div>
                                  <div className="text-[10px] opacity-80 truncate mt-0.5">
                                    {b.user_name || t.roleEmployee}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Empty Hover Prompt */}
                            {slotBookings.length === 0 && (
                              <div className="hidden group-hover:flex items-center justify-center w-full h-full text-[10px] text-[#1e40af] dark:text-[#38bdf8] font-semibold">
                                {language === 'vi' ? '+ Đặt' : '+ Book'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* VIEW 2: DAY VIEW OPTIMIZATION */
          <div className="p-4 space-y-3">
            {/* Horizontal Day Selector with Date Badge */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100 dark:border-zinc-800">
              {weekDays.map((day) => {
                const isSelected = day.dateStr === selectedDayStr;
                return (
                  <button
                    key={day.dateStr}
                    type="button"
                    onClick={() => setSelectedDayStr(day.dateStr)}
                    className={`flex flex-col items-center justify-center px-3.5 py-2 rounded-xl text-center transition-all shrink-0 min-w-[76px] border cursor-pointer ${
                      isSelected
                        ? 'bg-[#0a84ff] text-white border-[#0a84ff] shadow-xs'
                        : day.isToday
                        ? 'bg-blue-50 dark:bg-white/10 text-[#1e40af] dark:text-[#0a84ff] border-blue-200 dark:border-white/20 font-semibold'
                        : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/10'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold">{day.dayName}</span>
                    <span className="text-base font-bold font-mono">{day.dayNumber}</span>
                  </button>
                );
              })}
            </div>

            {/* Vertical Time Slots for selected day */}
            <div className="space-y-2 pt-1">
              {hours.map((hour) => {
                const hourNum = parseInt(hour.split(':')[0], 10);
                const matchedBooking = weekBookings.find((b) => {
                  const bDate = dayjs(b.start_at).format('YYYY-MM-DD');
                  if (bDate !== selectedDayStr) return false;
                  const bStartHour = dayjs(b.start_at).hour();
                  const bEndHour = dayjs(b.end_at).hour();
                  return hourNum >= bStartHour && hourNum < Math.max(bStartHour + 1, bEndHour);
                });

                if (matchedBooking) {
                  const isCheckedIn = matchedBooking.status === 'CHECKED_IN';
                  const isCancelled = matchedBooking.status === 'CANCELLED';

                  return (
                    <div
                      key={hour}
                      onClick={(e) => handleOpenBookingPreview(matchedBooking, e)}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all hover:scale-[1.01] ${
                        isCheckedIn
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
                          : isCancelled
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                          : 'bg-blue-500/10 border-blue-500/40 text-blue-900 dark:text-blue-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="font-mono font-bold text-sm min-w-[50px]">
                          {hour}
                        </div>
                        <div>
                          <div className="font-bold text-xs sm:text-sm">
                            {dayjs(matchedBooking.start_at).format('HH:mm')} - {dayjs(matchedBooking.end_at).format('HH:mm')}: {matchedBooking.purpose || t.internalWorkMeeting}
                          </div>
                          <div className="text-[11px] opacity-80 mt-0.5">
                            {t.meetingOrganizer} {matchedBooking.user_name || t.roleEmployee} · {matchedBooking.num_attendees} {t.peopleUnit}
                          </div>
                        </div>
                      </div>

                      <Tag color={isCheckedIn ? 'green' : isCancelled ? 'error' : 'blue'} className="m-0 text-xs">
                        {getBookingStatusLabel(matchedBooking.status, language)}
                      </Tag>
                    </div>
                  );
                }

                // Available slot
                return (
                  <div
                    key={hour}
                    onClick={() => handleBookSlot(selectedDayStr, hour)}
                    className={`p-2.5 rounded-xl border border-dashed flex items-center justify-between transition-colors cursor-pointer group ${
                      isDark
                        ? 'border-white/10 bg-white/5 hover:border-[#0a84ff] hover:bg-white/10'
                        : 'border-slate-200 bg-white hover:border-[#1e40af] hover:bg-blue-50/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="font-mono font-semibold text-slate-400 group-hover:text-[#1e40af] dark:group-hover:text-[#0a84ff] text-sm min-w-[50px]">
                        {hour}
                      </div>
                      <span className="text-xs text-slate-400 group-hover:text-[#1e40af] dark:group-hover:text-[#0a84ff]">
                        {t.calendarAvailableSlot}
                      </span>
                    </div>

                    <Button
                      type="primary"
                      size="small"
                      ghost
                      icon={<PlusOutlined />}
                      style={{ fontSize: 11, borderRadius: 6, borderColor: isDark ? '#0a84ff' : '#1e40af', color: isDark ? '#0a84ff' : '#1e40af' }}
                    >
                      {t.calendarBookThisSlot}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pop-up modal: Event details preview */}
      <Modal
        open={previewModalOpen}
        onCancel={() => setPreviewModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <CalendarOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
            <span className="font-bold text-base">
              {t.previewMeetingTitle}
            </span>
          </div>
        }
        footer={[
          <Button key="close" onClick={() => setPreviewModalOpen(false)} style={{ borderRadius: 6 }}>
            {t.close}
          </Button>,
          <Button
            key="book"
            type="primary"
            onClick={() => {
              setPreviewModalOpen(false);
              navigate(`/rooms/${room.id}/book`);
            }}
            style={{ backgroundColor: isDark ? '#0a84ff' : '#1e40af', borderColor: isDark ? '#0a84ff' : '#1e40af', borderRadius: 6 }}
          >
            {t.bookThisRoomBtn}
          </Button>,
        ]}
      >
        {previewBooking && (
          <div className="flex flex-col gap-4 py-2 text-xs sm:text-sm">
            <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <div className="font-bold text-base text-slate-800 dark:text-slate-100">
                  {previewBooking.purpose || t.internalWorkMeeting}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {t.fieldRoom}: {previewBooking.room_name}
                </div>
              </div>
              <Tag
                color={BOOKING_STATUS_CONFIG[previewBooking.status]?.color || 'default'}
                className="m-0 font-medium"
              >
                {getBookingStatusLabel(previewBooking.status, language)}
              </Tag>
            </div>

            <div className={`p-3.5 rounded-xl border flex flex-col gap-2.5 ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-500 dark:text-zinc-400">{t.meetingTimeLabel}:</span>
                <span className="font-mono font-bold text-black dark:text-white">
                  {dayjs(previewBooking.start_at).format('HH:mm')} - {dayjs(previewBooking.end_at).format('HH:mm')}
                  <span className="text-slate-500 dark:text-zinc-400 font-normal ml-2">
                    ({dayjs(previewBooking.start_at).format('DD/MM/YYYY')})
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <UserOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
                <span className="font-semibold">{t.meetingOrganizer}:</span>
                <span>{previewBooking.user_name || t.roleEmployee} ({previewBooking.user_email})</span>
              </div>

              <div className="flex items-center gap-2">
                <TeamOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
                <span className="font-semibold">{t.meetingAttendeesLabel}:</span>
                <span>{previewBooking.num_attendees} {t.peopleUnit}</span>
              </div>
            </div>

            {previewBooking.attendees.length > 0 && (
              <div className={`p-3.5 rounded-xl border w-full mx-auto ${
                isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="font-semibold text-xs text-slate-400 mb-3 text-center flex items-center justify-center gap-1.5 uppercase tracking-wider">
                  <TeamOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
                  <span>{t.meetingAttendeeListLabel} ({previewBooking.attendees.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto p-0.5 w-full">
                  {previewBooking.attendees.map((att) => (
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
            )}
          </div>
        )}
      </Modal>

      {/* Modal Add/Edit Equipment for this Room */}
      <Modal
        open={equipmentModalOpen}
        onCancel={() => setEquipmentModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <ToolOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
            <span className="font-bold text-base">
              {editingEquipment ? (language === 'vi' ? 'Sửa thiết bị phòng' : 'Edit Room Equipment') : (language === 'vi' ? 'Thêm thiết bị vào phòng này' : 'Add Equipment to Room')}
            </span>
          </div>
        }
        footer={null}
        centered
        destroyOnClose
      >
        <Form
          form={equipForm}
          layout="vertical"
          requiredMark={false}
          onFinish={handleSaveEquipment}
          className="pt-2"
        >
          <Form.Item
            name="name"
            label={<span className="font-medium text-xs text-slate-600 dark:text-zinc-300">{t.equipmentName}</span>}
            rules={[{ required: true, message: language === 'vi' ? 'Vui lòng nhập tên thiết bị' : 'Please enter equipment name' }]}
          >
            <Input placeholder={language === 'vi' ? 'VD: Sony Bravia 75" 4K TV' : 'e.g. Sony Bravia 75" 4K TV'} />
          </Form.Item>

          <Form.Item
            name="category"
            label={<span className="font-medium text-xs text-slate-600 dark:text-zinc-300">{t.equipmentCategoryLabel}</span>}
            rules={[{ required: true }]}
          >
            <Select
              options={STANDARD_EQUIPMENT.map((eq) => ({ value: eq, label: eq }))}
            />
          </Form.Item>

          <Form.Item
            name="status"
            label={<span className="font-medium text-xs text-slate-600 dark:text-zinc-300">{t.equipmentStatusLabel}</span>}
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'FUNCTIONAL', label: language === 'vi' ? 'Hoạt động tốt' : 'Functional' },
                { value: 'UNDER_REPAIR', label: language === 'vi' ? 'Đang bảo dưỡng / sửa chữa' : 'Under Repair' },
                { value: 'DECOMMISSIONED', label: language === 'vi' ? 'Ngừng sử dụng' : 'Decommissioned' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="room_ids"
            label={<span className="font-medium text-xs text-slate-600 dark:text-zinc-300">{t.equipmentAssignedRoom}</span>}
            extra={
              <span className="text-[11px] text-slate-400">
                {language === 'vi'
                  ? 'Có thể chọn thêm phòng khác nếu muốn phân bổ dùng chung'
                  : 'Can allocate to multiple rooms if shared'}
              </span>
            }
          >
            <Select
              mode="multiple"
              placeholder={t.selectMultipleRoomsPlaceholder}
              options={allRooms.map((r) => ({
                value: r.id,
                label: `${r.name} (${r.floor || 'Khu hội nghị'})`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="serial_number"
            label={<span className="font-medium text-xs text-slate-600 dark:text-zinc-300">{t.equipmentSerialLabel}</span>}
          >
            <Input placeholder="SN-LOGI-8891-VN" />
          </Form.Item>

          <Form.Item
            name="notes"
            label={<span className="font-medium text-xs text-slate-600 dark:text-zinc-300">{t.equipmentNotesLabel}</span>}
          >
            <Input.TextArea rows={3} placeholder={language === 'vi' ? 'Ghi chú vị trí, cáp kết nối...' : 'Placement notes, connectivity info...'} />
          </Form.Item>

          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-2">
            <Button onClick={() => setEquipmentModalOpen(false)}>
              {t.cancel}
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={equipmentSubmitting}
              style={{
                backgroundColor: isDark ? '#0a84ff' : '#1e40af',
                borderColor: isDark ? '#0a84ff' : '#1e40af',
                borderRadius: 8,
              }}
            >
              {editingEquipment ? t.saveChangesSubmitBtn : t.confirm}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
