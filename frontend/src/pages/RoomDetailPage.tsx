import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Typography,
  Tag,
  Button,
  Space,
  Spin,
  App,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm,
  Tooltip,
} from 'antd';
import {
  TeamOutlined,
  EnvironmentOutlined,
  UserOutlined,
  CalendarOutlined,
  PlusOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  VideoCameraOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PictureOutlined,
  ToolOutlined,
  EditOutlined,
  DeleteOutlined,
  BarcodeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  Room,
  Booking,
  ROOM_STATUS_CONFIG,
  getRoomStatusLabel,
  getEquipmentLabel,
  EquipmentItem,
  EquipmentStatus,
  EQUIPMENT_STATUS_CONFIG,
  STANDARD_EQUIPMENT,
} from '../types';
import { getRoomById, getBookings, getEquipmentByRoom, getRooms, createEquipment, updateEquipment, deleteEquipment } from '../api/client';
import { ApiErrorState } from '../components/ApiErrorState';
import { BookingCalendar, BookingPreviewModal } from '../components/BookingCalendar';
import type { CalendarViewMode } from '../utils/bookingCalendar';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

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

  // Calendar anchor date and 4 view modes (day, week, month, year)
  const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>('week');
  const [currentDate, setCurrentDate] = useState<dayjs.Dayjs>(() => dayjs().startOf('day'));

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
      if (err?.status === 401) return;
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
      if (err?.status === 401) return;
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
      if (err?.status === 401) return;
      if (!err?.errorFields) {
        message.error(err.message || 'Error saving equipment');
      }
    } finally {
      setEquipmentSubmitting(false);
    }
  };

  const handleOpenBookingPreview = (b: Booking, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewBooking(b);
    setPreviewModalOpen(true);
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
        {/* Left: Room Photo */}
        <Col xs={24} md={10}>
          <div className={`w-full aspect-video rounded-2xl border relative overflow-hidden transition-colors ${
            isDark ? 'bg-[#1c1c1e] border-white/10' : 'bg-slate-50 border-slate-200'
          }`}>
            {room.image_url ? (
              <img src={room.image_url} alt={room.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-2 ${
                  isDark ? 'bg-white/5 text-[#0a84ff] border border-white/10' : 'bg-white text-[#1e40af] shadow-xs'
                }`}>
                  <PictureOutlined style={{ fontSize: 26 }} />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {room.name}
                </span>
                <span className="text-xs text-slate-400">
                  {room.floor || 'Khu hội nghị'}
                </span>
              </div>
            )}

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
          <div className={`rounded-2xl border p-5 flex flex-col gap-3 transition-colors ${
            isDark ? 'bg-[#1c1c1e] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            {/* Name */}
            <div className="flex items-start justify-between gap-3">
              <Title level={isMobile ? 4 : 3} style={{ margin: 0, fontWeight: 700, color: isDark ? '#ffffff' : '#141b54' }}>
                {room.name}
              </Title>
            </div>

            {/* Unboxed Metadata */}
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-400">
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

            <Paragraph className={`text-xs sm:text-sm leading-relaxed !mb-0 ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
              {room.description || t.defaultRoomDescription}
            </Paragraph>

            {/* Equipment Section */}
            <div className="border-t border-slate-100 dark:border-white/10 pt-3">
              <div className="flex items-center gap-2 mb-2.5">
                <ToolOutlined className="text-[#1e40af] dark:text-[#0a84ff] text-sm" />
                <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white">
                  {t.equipmentInRoomTitle}
                </span>
                {(() => {
                  const activeCount = roomEquipments.filter((e) => e.status !== 'DECOMMISSIONED').length;
                  return activeCount > 0 ? (
                    <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-300">
                      {activeCount} {language === 'vi' ? 'thiết bị' : 'items'}
                    </span>
                  ) : null;
                })()}
              </div>

              {/* Grouped equipment list — DECOMMISSIONED excluded */}
              {(() => {
                const active = roomEquipments.filter((e) => e.status !== 'DECOMMISSIONED');
                if (active.length === 0) {
                  return (
                    <div className="text-xs text-slate-400 py-2 text-center">
                      {language === 'vi' ? 'Phòng chưa có thiết bị nào' : 'No equipment registered'}
                    </div>
                  );
                }

                // Group by category
                const grouped: Record<string, EquipmentItem[]> = {};
                for (const item of active) {
                  if (!grouped[item.category]) grouped[item.category] = [];
                  grouped[item.category].push(item);
                }

                return (
                  <div className="space-y-1.5">
                    {Object.entries(grouped).map(([category, items]) => (
                      <div
                        key={category}
                        className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border ${
                          isDark ? 'bg-[#242426] border-white/8' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {/* Category + count */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200 truncate">
                              {category}
                            </span>
                            <span className={`text-[10px] font-mono font-bold px-1 rounded ${
                              isDark ? 'bg-white/10 text-zinc-400' : 'bg-slate-200 text-slate-500'
                            }`}>
                              ×{items.length}
                            </span>
                          </div>
                          {/* Individual items */}
                          <div className="flex flex-wrap gap-1">
                            {items.map((item) => {
                              const isUnderRepair = item.status === 'UNDER_REPAIR';
                              return (
                                <span
                                  key={item.id}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${
                                    isUnderRepair
                                      ? isDark
                                        ? 'bg-amber-950/40 border-amber-700/50 text-amber-300'
                                        : 'bg-amber-50 border-amber-200 text-amber-700'
                                      : isDark
                                        ? 'bg-white/5 border-white/10 text-zinc-300'
                                        : 'bg-white border-slate-200 text-slate-600'
                                  }`}
                                >
                                  {item.name}
                                  {isUnderRepair && (
                                    <Tooltip title={language === 'vi' ? 'Đang bảo dưỡng' : 'Under repair'}>
                                      <ToolOutlined className="text-amber-500 text-[9px]" />
                                    </Tooltip>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Primary Action Button */}
            <div className="pt-2 border-t border-slate-100 dark:border-white/10">
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

      {/* GOOGLE CALENDAR WEEKLY SCHEDULE VIEW */}
      <BookingCalendar
        bookings={bookings}
        currentDate={currentDate}
        onCurrentDateChange={setCurrentDate}
        viewMode={calendarViewMode}
        showViewModeSelector
        onViewModeChange={setCalendarViewMode}
        onBookingClick={handleOpenBookingPreview}
      />

      {/* Pop-up modal: Event details preview */}
      <BookingPreviewModal
        booking={previewBooking}
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        onActionClick={() => {
          setPreviewModalOpen(false);
          navigate(`/rooms/${room.id}/book`);
        }}
      />

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
