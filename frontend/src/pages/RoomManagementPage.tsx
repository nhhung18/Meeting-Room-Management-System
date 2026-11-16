import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  Select,
  Tag,
  Space,
  Drawer,
  Form,
  InputNumber,
  Checkbox,
  Typography,
  Popconfirm,
  Tooltip,
  App,
  Row,
  Col,
  Spin,
  Pagination,
  Modal,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  TeamOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  PictureOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  CloseOutlined,
  CheckOutlined,
  InfoCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Room, RoomStatus, ROOM_STATUS_CONFIG, STANDARD_EQUIPMENT, getRoomStatusLabel, getEquipmentLabel } from '../types';
import { getRooms, createRoom, updateRoom, deleteRoom, forceReleaseRoom, toggleRoomMaintenance } from '../api/client';
import { ApiErrorState } from '../components/ApiErrorState';
import { EmptyRoomState } from '../components/EmptyRoomState';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const { Title, Text } = Typography;
const { Search } = Input;

// ── Equipment chip selector (standard equipment) ──────────────────────────────
interface EquipmentChipGroupProps {
  value?: string[];
  onChange?: (val: string[]) => void;
  standardEquipment: string[];
  language: string;
  isDark: boolean;
  getEquipmentLabel: (eq: string, lang: string) => string;
}

const EquipmentChipGroup: React.FC<EquipmentChipGroupProps> = ({
  value = [],
  onChange,
  standardEquipment,
  language,
  isDark,
  getEquipmentLabel,
}) => {
  const toggle = (eq: string) => {
    if (value.includes(eq)) {
      onChange?.(value.filter((v) => v !== eq));
    } else {
      onChange?.([...value, eq]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {standardEquipment.map((eq) => {
        const selected = value.includes(eq);
        return (
          <button
            key={eq}
            type="button"
            onClick={() => toggle(eq)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer select-none ${
              selected
                ? isDark
                  ? 'bg-[#0a84ff]/20 border-[#0a84ff] text-[#0a84ff]'
                  : 'bg-blue-50 border-[#1e40af] text-[#1e40af]'
                : isDark
                ? 'bg-white/5 border-white/15 text-zinc-400 hover:border-white/30 hover:text-zinc-200'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'
            }`}
          >
            {selected && <CheckOutlined style={{ fontSize: 10 }} />}
            {getEquipmentLabel(eq, language)}
          </button>
        );
      })}
    </div>
  );
};

// ── Custom equipment removable tags ───────────────────────────────────────────
interface CustomEquipmentTagsProps {
  value?: string[];
  onChange?: (val: string[]) => void;
  standardEquipment: string[];
  isDark: boolean;
  getEquipmentLabel: (eq: string, lang: string) => string;
  language: string;
}

const CustomEquipmentTags: React.FC<CustomEquipmentTagsProps> = ({
  value = [],
  onChange,
  standardEquipment,
  isDark,
  getEquipmentLabel,
  language,
}) => {
  const customItems = value.filter((v) => !standardEquipment.includes(v));
  if (customItems.length === 0) return null;

  const remove = (eq: string) => onChange?.(value.filter((v) => v !== eq));

  return (
    <div className="mt-3">
      <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
        {language === 'vi' ? 'Thiết bị tuỳ chỉnh đã thêm' : 'Added custom equipment'}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {customItems.map((eq) => (
          <span
            key={eq}
            className={`flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-medium border ${
              isDark
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
          >
            {getEquipmentLabel(eq, language)}
            <button
              type="button"
              onClick={() => remove(eq)}
              className={`w-4 h-4 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                isDark ? 'hover:bg-amber-500/30 text-amber-400' : 'hover:bg-amber-200 text-amber-600'
              }`}
            >
              <CloseOutlined style={{ fontSize: 9 }} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};

export const RoomManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { t, language } = useLanguage();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number; detail: string } | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RoomStatus | 'ALL'>('ALL');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [customEquipment, setCustomEquipment] = useState('');

  // Admin Override States
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [selectedReleaseRoom, setSelectedReleaseRoom] = useState<Room | null>(null);
  const [releaseReason, setReleaseReason] = useState('');
  const [releasing, setReleasing] = useState(false);

  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [selectedMaintenanceRoom, setSelectedMaintenanceRoom] = useState<Room | null>(null);
  const [maintenanceReason, setMaintenanceReason] = useState('');
  const [maintaining, setMaintaining] = useState(false);

  const [form] = Form.useForm();

  const fetchRooms = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getRooms({
        q: searchQuery,
        status: statusFilter,
      });
      setRooms(res.items);
    } catch (err: any) {
      setError({
        status: err.status ?? 0,
        detail: err.detail || err.message || (language === 'vi' ? 'Lỗi khi tải danh sách phòng' : 'Error loading rooms list'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [searchQuery, statusFilter]);

  const handleOpenCreate = () => {
    setEditingRoom(null);
    form.resetFields();
    form.setFieldsValue({
      status: 'AVAILABLE',
      capacity: 10,
      equipment: [STANDARD_EQUIPMENT[0], STANDARD_EQUIPMENT[2]],
    });
    setDrawerOpen(true);
  };

  const handleOpenEdit = (record: Room) => {
    setEditingRoom(record);
    form.setFieldsValue({
      name: record.name,
      capacity: record.capacity,
      status: record.status,
      floor: record.floor,
      owner_id: record.owner_id,
      description: record.description,
      equipment: record.equipment,
    });
    setDrawerOpen(true);
  };

  const handleDelete = async (record: Room) => {
    try {
      await deleteRoom(record.id);
      message.success(
        language === 'vi' ? `Đã xóa phòng ${record.name}` : `Deleted room ${record.name}`
      );
      fetchRooms();
    } catch (err: any) {
      if (err.status === 400 || err.message?.includes('active booking')) {
        message.error(t.roomDeleteErrorHasBookings);
      } else {
        message.error(err.message || (language === 'vi' ? 'Lỗi khi xóa phòng' : 'Error deleting room'));
      }
    }
  };

  const handleAddCustomEquipment = () => {
    if (!customEquipment.trim()) return;
    const current = form.getFieldValue('equipment') || [];
    if (!current.includes(customEquipment.trim())) {
      form.setFieldsValue({
        equipment: [...current, customEquipment.trim()],
      });
      message.success(
        language === 'vi'
          ? `Đã thêm thiết bị "${customEquipment.trim()}"`
          : `Added equipment "${customEquipment.trim()}"`
      );
    }
    setCustomEquipment('');
  };

  // Admin Override Actions
  const handleConfirmForceRelease = async () => {
    if (!selectedReleaseRoom || !user) return;
    if (!releaseReason.trim()) {
      message.warning(t.forceReleaseReasonPrompt);
      return;
    }
    try {
      setReleasing(true);
      const res = await forceReleaseRoom(selectedReleaseRoom.id, releaseReason.trim(), {
        id: user.id,
        name: user.name,
        role: user.role,
      });
      message.success(
        language === 'vi'
          ? `Đã cưỡng chế giải phóng phòng ${res.room.name}. Đã hủy ${res.cancelledBookingsCount} lịch liên quan.`
          : `Force released ${res.room.name}. Cancelled ${res.cancelledBookingsCount} ongoing bookings.`
      );
      setReleaseModalOpen(false);
      setReleaseReason('');
      fetchRooms();
    } catch (err: any) {
      message.error(err.message || 'Error releasing room');
    } finally {
      setReleasing(false);
    }
  };

  const handleConfirmMaintenanceToggle = async () => {
    if (!selectedMaintenanceRoom || !user) return;
    const isCurrentlyMaintenance = selectedMaintenanceRoom.status === 'MAINTENANCE';
    try {
      setMaintaining(true);
      await toggleRoomMaintenance(
        selectedMaintenanceRoom.id,
        !isCurrentlyMaintenance,
        maintenanceReason.trim(),
        {
          id: user.id,
          name: user.name,
          role: user.role,
        }
      );
      message.success(t.maintenanceStatusUpdated);
      setMaintenanceModalOpen(false);
      setMaintenanceReason('');
      fetchRooms();
    } catch (err: any) {
      message.error(err.message || 'Error toggling maintenance');
    } finally {
      setMaintaining(false);
    }
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingRoom) {
        await updateRoom(editingRoom.id, {
          name: values.name,
          capacity: values.capacity,
          status: values.status,
          floor: values.floor,
          owner_id: values.owner_id,
          description: values.description,
          equipment: values.equipment || [],
        });
        message.success(t.roomUpdateSuccess);
      } else {
        await createRoom({
          name: values.name,
          capacity: values.capacity,
          status: values.status,
          floor: values.floor,
          owner_id: values.owner_id,
          description: values.description,
          equipment: values.equipment || [],
        });
        message.success(t.roomCreateSuccess);
      }

      setDrawerOpen(false);
      fetchRooms();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || (language === 'vi' ? 'Lỗi khi lưu phòng họp' : 'Error saving room'));
    } finally {
      setSubmitting(false);
    }
  };

  // Paginated rooms
  const paginatedRooms = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return rooms.slice(startIndex, startIndex + pageSize);
  }, [rooms, currentPage, pageSize]);

  return (
    <div className="space-y-4 max-w-full">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700, color: isDark ? '#f8fafc' : '#141b54' }}>
            {t.roomManagementTitle}
          </Title>
          <Text type="secondary" style={{ fontSize: 13, color: isDark ? '#94a3b8' : undefined }}>
            {t.roomManagementSubtitle}
          </Text>
        </div>

        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="middle"
          onClick={handleOpenCreate}
          style={{
            backgroundColor: isDark ? '#0a84ff' : '#1e40af',
            borderColor: isDark ? '#0a84ff' : '#1e40af',
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          {t.addNewRoomBtn}
        </Button>
      </div>

      {/* Filter Bar */}
      <div className={`p-3.5 rounded-2xl border transition-colors ${
        isDark ? 'bg-[#1c1c1e] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <Search
              placeholder={t.searchRoomManagementPlaceholder}
              allowClear
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: '100%', maxWidth: 300 }}
              prefix={<SearchOutlined className="text-slate-400" />}
            />

            <Select
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
              style={{ width: '100%', maxWidth: 200 }}
              options={[
                { value: 'ALL', label: t.allStatuses },
                { value: 'AVAILABLE', label: t.statusAvailable },
                { value: 'MAINTENANCE', label: t.statusMaintenance },
                { value: 'ARCHIVED', label: t.statusArchived },
              ]}
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs font-mono font-medium px-2 py-1 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-zinc-200 border border-slate-200 dark:border-white/15">
              {rooms.length} {language === 'vi' ? 'phòng' : 'rooms'}
            </span>
            <Button icon={<ReloadOutlined />} onClick={fetchRooms} style={{ borderRadius: 8 }}>
              {t.refreshData}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content: Card Grid (Synchronized, No Table) */}
      {error ? (
        <ApiErrorState error={error} onRetry={fetchRooms} />
      ) : loading ? (
        <div className={`py-16 text-center rounded-2xl border ${isDark ? 'bg-[#1c1c1e] border-white/15' : 'bg-white border-slate-200'}`}>
          <Spin size="large" description={t.loadingRooms} />
        </div>
      ) : rooms.length === 0 ? (
        <EmptyRoomState
          title={t.emptyRooms || t.noRoomsFound}
          description={
            language === 'vi'
              ? (searchQuery || statusFilter !== 'ALL')
                ? 'Không có phòng họp nào khớp với điều kiện tìm kiếm hoặc trạng thái hiện tại.'
                : 'Hệ thống hiện chưa có phòng họp nào. Bấm nút bên dưới để tạo phòng họp đầu tiên.'
              : (searchQuery || statusFilter !== 'ALL')
                ? 'No meeting rooms match your current search or status filter.'
                : 'There are currently no meeting rooms in the system. Click below to add your first room.'
          }
          isDark={isDark}
          primaryActionLabel={t.addNewRoomBtn}
          primaryActionIcon={<PlusOutlined />}
          onPrimaryAction={handleOpenCreate}
          secondaryActionLabel={t.refreshData}
          onSecondaryAction={fetchRooms}
        />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {paginatedRooms.map((room) => {
              const statusCfg = ROOM_STATUS_CONFIG[room.status];

              return (
                <Col xs={24} sm={12} lg={8} key={room.id}>
                  <div
                    className={`h-full flex flex-col justify-between rounded-2xl p-4 border transition-all ${
                      isDark ? 'bg-[#1c1c1e] border-white/15 hover:border-[#0a84ff] hover:bg-[#242426]' : 'bg-white border-slate-200 shadow-2xs hover:border-[#1e40af]'
                    }`}
                  >
                    <div>
                      {/* Ô div để add ảnh phòng sau này */}
                      <div
                        onClick={() => handleOpenEdit(room)}
                        className={`w-full h-36 rounded-xl mb-3 border border-dashed flex flex-col items-center justify-center relative overflow-hidden transition-all cursor-pointer group ${
                          isDark
                            ? 'bg-[#242426] border-white/15 hover:border-[#0a84ff]'
                            : 'bg-slate-50 border-slate-200 hover:border-[#1e40af]'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-200/60 dark:bg-white/10 flex items-center justify-center mb-1 text-slate-400 group-hover:text-[#1e40af] dark:group-hover:text-[#0a84ff] transition-colors">
                          <PictureOutlined className="text-xl" />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-zinc-400 group-hover:text-slate-700 dark:group-hover:text-zinc-200 font-medium">
                          {t.roomPhotoPlaceholder}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                          {t.roomPhotoHint}
                        </span>
                      </div>

                      {/* Top Row: Sức chứa & Trạng thái */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-medium flex items-center gap-1 ${
                          isDark ? 'bg-white/5 text-zinc-200 border border-white/10' : 'bg-slate-100 text-slate-700'
                        }`}>
                          <TeamOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
                          <span>{room.capacity} {t.peopleUnit}</span>
                        </span>

                        <Tag color={statusCfg?.color || 'default'} className="m-0 font-medium">
                          {getRoomStatusLabel(room.status, language)}
                        </Tag>
                      </div>

                      {/* Tên phòng */}
                      <div
                        className="font-bold text-base hover:text-[#1e40af] dark:hover:text-[#0a84ff] transition-colors cursor-pointer line-clamp-1 mb-1"
                        onClick={() => handleOpenEdit(room)}
                      >
                        {room.name}
                      </div>

                      {/* Vị trí phòng */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-3">
                        <EnvironmentOutlined className="text-[#1e40af] dark:text-[#0a84ff] shrink-0" />
                        <span className="text-slate-400 shrink-0">{t.locationLabel}:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                          {room.floor || t.defaultRoomFloor}
                        </span>
                      </div>

                      {/* Thiết bị with Tooltip on +N */}
                      <div className="mb-4">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                          {t.filterEquipmentLabel} ({room.equipment.length}):
                        </div>
                        <div className="flex flex-wrap gap-1 items-center">
                          {room.equipment.slice(0, 3).map((eq, i) => (
                            <span
                              key={i}
                              className={`text-[11px] px-1.5 py-0.5 rounded border ${
                                isDark
                                  ? 'bg-white/5 border-white/10 text-zinc-300'
                                  : 'bg-slate-50 border-slate-200 text-slate-600'
                              }`}
                            >
                              {getEquipmentLabel(eq, language)}
                            </span>
                          ))}
                          {room.equipment.length > 3 && (
                            <Tooltip
                              title={
                                <div>
                                  <div className="font-semibold text-xs mb-1 text-slate-200">{t.otherEquipmentTitle} (+{room.equipment.length - 3}):</div>
                                  <div className="flex flex-wrap gap-1">
                                    {room.equipment.slice(3).map((eq, idx) => (
                                      <span key={idx} className="text-[11px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-100">
                                        {getEquipmentLabel(eq, language)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              }
                            >
                              <span className="text-[11px] text-[#1e40af] dark:text-[#0a84ff] font-semibold cursor-pointer px-1.5 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-zinc-800 transition-colors">
                                +{room.equipment.length - 3}
                              </span>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions: Chi tiết, Sửa, Xóa */}
                    <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex flex-col gap-2 mt-auto">
                      <div className="flex items-center justify-between">
                        <Button
                          type="link"
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => navigate(`/rooms/${room.id}`)}
                          style={{ paddingLeft: 0, color: isDark ? '#0a84ff' : '#1e40af', fontSize: 12 }}
                        >
                          {t.actionView}
                        </Button>

                        <Space size="small">
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleOpenEdit(room)}
                            style={{
                              borderRadius: 6,
                              borderColor: isDark ? '#0a84ff' : '#1e40af',
                              color: isDark ? '#0a84ff' : '#1e40af',
                              fontWeight: 500,
                            }}
                          >
                            {t.actionEdit}
                          </Button>

                          <Popconfirm
                            title={t.deleteRoomConfirmTitle}
                            description={
                              language === 'vi'
                                ? `Bạn có chắc muốn xóa vĩnh viễn phòng ${room.name}?`
                                : `Are you sure you want to permanently delete room ${room.name}?`
                            }
                            okText={t.actionDelete}
                            cancelText={t.cancel}
                            okButtonProps={{ danger: true }}
                            onConfirm={() => handleDelete(room)}
                          >
                            <Button
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              style={{ borderRadius: 6 }}
                            >
                              {t.actionDelete}
                            </Button>
                          </Popconfirm>
                        </Space>
                      </div>

                      {/* Admin Override Action Bar */}
                      {user?.role === 'ADMINISTRATOR' && (
                        <div className="pt-2 border-t border-dashed border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                          <Tooltip title={t.forceReleaseReasonPrompt}>
                            <Button
                              size="small"
                              danger
                              icon={<ThunderboltOutlined />}
                              onClick={() => {
                                setSelectedReleaseRoom(room);
                                setReleaseReason(language === 'vi' ? 'Admin giải phóng phòng sớm' : 'Admin forced release');
                                setReleaseModalOpen(true);
                              }}
                              className="text-[11px] font-medium"
                            >
                              {language === 'vi' ? 'Cưỡng chế mở' : 'Force Free'}
                            </Button>
                          </Tooltip>

                          <Button
                            size="small"
                            icon={<ToolOutlined />}
                            onClick={() => {
                              setSelectedMaintenanceRoom(room);
                              setMaintenanceReason(
                                room.status === 'MAINTENANCE'
                                  ? (language === 'vi' ? 'Đã hoàn tất kiểm tra kỹ thuật' : 'Maintenance completed')
                                  : (language === 'vi' ? 'Bảo trì sửa chữa thiết bị' : 'Scheduled maintenance')
                              );
                              setMaintenanceModalOpen(true);
                            }}
                            className="text-[11px]"
                          >
                            {room.status === 'MAINTENANCE'
                              ? (language === 'vi' ? 'Mở lại' : 'Reactivate')
                              : (language === 'vi' ? 'Bảo trì' : 'Maintain')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>

          {/* Pagination */}
          <div className="flex justify-end pt-3">
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={rooms.length}
              onChange={(page, size) => {
                setCurrentPage(page);
                setPageSize(size);
              }}
              showTotal={(total) => language === 'vi' ? `Tổng cộng ${total} phòng họp` : `Total ${total} meeting rooms`}
              showSizeChanger
              pageSizeOptions={['6', '9', '12', '24']}
            />
          </div>
        </>
      )}

      {/* Create / Edit Drawer */}
      <Drawer
        title={null}
        placement="right"
        width={typeof window !== 'undefined' && window.innerWidth < 768 ? '100%' : 520}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        closeIcon={null}
        styles={{
          body: { backgroundColor: isDark ? '#1c1c1e' : '#f8fafc', padding: 0 },
          wrapper: { boxShadow: isDark ? '-8px 0 32px rgba(0,0,0,0.6)' : '-8px 0 32px rgba(0,0,0,0.12)' },
        }}
        footer={
          <div className={`flex items-center justify-between gap-3 px-5 py-3.5 border-t ${isDark ? 'border-white/10 bg-[#1c1c1e]' : 'border-slate-200 bg-white'}`}>
            <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
              {editingRoom
                ? (language === 'vi' ? `Chỉnh sửa: ${editingRoom.name}` : `Editing: ${editingRoom.name}`)
                : (language === 'vi' ? 'Tạo phòng họp mới' : 'Creating new meeting room')}
            </span>
            <div className="flex items-center gap-2">
              <Button onClick={() => setDrawerOpen(false)} style={{ borderRadius: 8 }}>
                {t.cancel}
              </Button>
              <Button
                type="primary"
                loading={submitting}
                icon={editingRoom ? <CheckOutlined /> : <PlusOutlined />}
                onClick={handleFormSubmit}
                style={{
                  backgroundColor: isDark ? '#0a84ff' : '#1e40af',
                  borderColor: isDark ? '#0a84ff' : '#1e40af',
                  borderRadius: 8,
                  fontWeight: 600,
                  minWidth: 120,
                }}
              >
                {editingRoom ? t.saveChangesSubmitBtn : t.createRoomSubmitBtn}
              </Button>
            </div>
          </div>
        }
      >
        {/* Drawer Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between ${isDark ? 'bg-[#242426] border-white/10' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-[#0a84ff]/15' : 'bg-blue-50'}`}>
              {editingRoom ? (
                <EditOutlined className={isDark ? 'text-[#0a84ff]' : 'text-[#1e40af]'} style={{ fontSize: 16 }} />
              ) : (
                <PlusOutlined className={isDark ? 'text-[#0a84ff]' : 'text-[#1e40af]'} style={{ fontSize: 16 }} />
              )}
            </div>
            <div>
              <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {editingRoom ? t.drawerEditRoomTitle : t.drawerCreateRoomTitle}
              </div>
              {editingRoom && (
                <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>ID: {editingRoom.id}</div>
              )}
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${isDark ? 'hover:bg-white/10 text-zinc-400 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'}`}
          >
            <CloseOutlined style={{ fontSize: 14 }} />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="overflow-y-auto h-full pb-4">
          <Form form={form} layout="vertical" requiredMark="optional">

            {/* Section: Thông tin cơ bản */}
            <div className={`mx-4 mt-4 rounded-2xl border ${isDark ? 'bg-[#242426] border-white/10' : 'bg-white border-slate-200'}`}>
              <div className={`px-4 py-3 border-b flex items-center gap-2 ${isDark ? 'border-white/8' : 'border-slate-100'}`}>
                <InfoCircleOutlined className={isDark ? 'text-[#0a84ff]' : 'text-[#1e40af]'} />
                <span className={`font-semibold text-xs uppercase tracking-wider ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                  {language === 'vi' ? 'Thông tin cơ bản' : 'Basic Information'}
                </span>
              </div>
              <div className="p-4 space-y-3">
                <Form.Item
                  label={<span className={`font-semibold text-xs ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>{t.fieldName}</span>}
                  name="name"
                  rules={[{ required: true, message: t.errRequiredName }]}
                  style={{ marginBottom: 0 }}
                >
                  <Input
                    placeholder={t.fieldNamePlaceholder}
                    size="large"
                    style={{ borderRadius: 10 }}
                  />
                </Form.Item>

                <Row gutter={12}>
                  <Col xs={12}>
                    <Form.Item
                      label={
                        <span className={`font-semibold text-xs ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                          <TeamOutlined className="mr-1" />{t.fieldCapacityNumber}
                        </span>
                      }
                      name="capacity"
                      rules={[
                        { required: true, message: t.fieldCapacityNumber },
                        { type: 'number', min: 1, message: language === 'vi' ? 'Tối thiểu 1 người' : 'Min 1' },
                      ]}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber
                        min={1} max={500}
                        style={{ width: '100%', borderRadius: 10 }}
                        size="large"
                        addonAfter={<span className="text-xs text-slate-400">{t.peopleUnit}</span>}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={12}>
                    <Form.Item
                      label={<span className={`font-semibold text-xs ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>{t.fieldStatus}</span>}
                      name="status"
                      rules={[{ required: true, message: t.fieldStatus }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Select
                        size="large"
                        style={{ borderRadius: 10 }}
                        options={[
                          { value: 'AVAILABLE', label: <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />{t.statusAvailable}</span> },
                          { value: 'MAINTENANCE', label: <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5" />{t.statusMaintenance}</span> },
                          { value: 'ARCHIVED', label: <span><span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1.5" />{t.statusArchived}</span> },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            </div>

            {/* Section: Vị trí & Quản lý */}
            <div className={`mx-4 mt-3 rounded-2xl border ${isDark ? 'bg-[#242426] border-white/10' : 'bg-white border-slate-200'}`}>
              <div className={`px-4 py-3 border-b flex items-center gap-2 ${isDark ? 'border-white/8' : 'border-slate-100'}`}>
                <EnvironmentOutlined className={isDark ? 'text-[#0a84ff]' : 'text-[#1e40af]'} />
                <span className={`font-semibold text-xs uppercase tracking-wider ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                  {language === 'vi' ? 'Vị trí & Quản lý' : 'Location & Manager'}
                </span>
              </div>
              <div className="p-4 space-y-3">
                <Form.Item
                  label={<span className={`font-semibold text-xs ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>{t.fieldLocationFloor}</span>}
                  name="floor"
                  style={{ marginBottom: 0 }}
                >
                  <Input
                    placeholder={t.fieldLocationFloorPlaceholder}
                    size="large"
                    style={{ borderRadius: 10 }}
                    prefix={<EnvironmentOutlined className="text-slate-400" />}
                  />
                </Form.Item>
                <Form.Item
                  label={<span className={`font-semibold text-xs ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>{t.fieldManagerInCharge}</span>}
                  name="owner_id"
                  style={{ marginBottom: 0 }}
                >
                  <Input
                    placeholder={t.fieldManagerInChargePlaceholder}
                    size="large"
                    style={{ borderRadius: 10 }}
                    prefix={<UserOutlined className="text-slate-400" />}
                  />
                </Form.Item>
              </div>
            </div>

            {/* Section: Thiết bị */}
            <div className={`mx-4 mt-3 rounded-2xl border ${isDark ? 'bg-[#242426] border-white/10' : 'bg-white border-slate-200'}`}>
              <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'border-white/8' : 'border-slate-100'}`}>
                <div className="flex items-center gap-2">
                  <ToolOutlined className={isDark ? 'text-[#0a84ff]' : 'text-[#1e40af]'} />
                  <span className={`font-semibold text-xs uppercase tracking-wider ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                    {language === 'vi' ? 'Thiết bị sẵn có' : 'Available Equipment'}
                  </span>
                </div>
                <Form.Item name="equipment" noStyle>
                  <span />
                </Form.Item>
                <span className={`text-xs font-mono px-2 py-0.5 rounded-md ${isDark ? 'bg-white/8 text-zinc-400' : 'bg-slate-100 text-slate-500'}`}>
                  {(form.getFieldValue('equipment') || []).length} {language === 'vi' ? 'mục' : 'items'}
                </span>
              </div>

              <div className="p-4 space-y-4">
                {/* Standard equipment chips */}
                <div>
                  <p className={`text-xs mb-2.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                    {language === 'vi' ? 'Nhấn để chọn / bỏ chọn thiết bị tiêu chuẩn' : 'Click to select / deselect standard equipment'}
                  </p>
                  <Form.Item name="equipment" noStyle>
                    <EquipmentChipGroup
                      standardEquipment={STANDARD_EQUIPMENT}
                      language={language}
                      isDark={isDark}
                      getEquipmentLabel={getEquipmentLabel}
                    />
                  </Form.Item>
                </div>

                {/* Custom equipment */}
                <div className={`pt-3 border-t ${isDark ? 'border-white/8' : 'border-slate-100'}`}>
                  <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    {t.addCustomEquipmentLabel}
                  </p>
                  <Space.Compact style={{ width: '100%' }}>
                    <Input
                      placeholder={t.customEquipmentPlaceholder}
                      value={customEquipment}
                      onChange={(e) => setCustomEquipment(e.target.value)}
                      onPressEnter={handleAddCustomEquipment}
                      style={{ borderRadius: '10px 0 0 10px' }}
                    />
                    <Button
                      onClick={handleAddCustomEquipment}
                      type="primary"
                      icon={<PlusOutlined />}
                      disabled={!customEquipment.trim()}
                      style={{
                        borderRadius: '0 10px 10px 0',
                        backgroundColor: isDark ? '#0a84ff' : '#1e40af',
                        borderColor: isDark ? '#0a84ff' : '#1e40af',
                      }}
                    >
                      {t.addCustomEquipmentBtn}
                    </Button>
                  </Space.Compact>

                  {/* Custom equipment tags */}
                  <Form.Item name="equipment" noStyle>
                    <CustomEquipmentTags
                      standardEquipment={STANDARD_EQUIPMENT}
                      isDark={isDark}
                      getEquipmentLabel={getEquipmentLabel}
                      language={language}
                    />
                  </Form.Item>
                </div>
              </div>
            </div>

          </Form>
        </div>
      </Drawer>

      {/* Admin Override: Force Release Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-rose-600">
            <ThunderboltOutlined />
            <span>{t.forceReleaseConfirmTitle}</span>
          </div>
        }
        open={releaseModalOpen}
        onCancel={() => setReleaseModalOpen(false)}
        onOk={handleConfirmForceRelease}
        confirmLoading={releasing}
        okText={t.confirm}
        cancelText={t.cancel}
        okButtonProps={{ danger: true }}
      >
        <div className="space-y-3 py-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {language === 'vi'
              ? `Bạn đang thực hiện quyền Administrator để giải phóng phòng ${selectedReleaseRoom?.name}. Toàn bộ cuộc họp đang diễn ra hoặc chuẩn bị diễn ra hôm nay trong phòng này sẽ được hủy với lý do cưỡng chế.`
              : `You are exercising Administrator override to force-release room ${selectedReleaseRoom?.name}. Any ongoing or upcoming reservations today in this room will be cancelled.`}
          </p>
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              {t.forceReleaseReasonPrompt}
            </label>
            <Input.TextArea
              rows={3}
              value={releaseReason}
              onChange={(e) => setReleaseReason(e.target.value)}
              placeholder={t.forceReleaseReasonPlaceholder}
            />
          </div>
        </div>
      </Modal>

      {/* Admin Override: Toggle Maintenance Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-amber-600">
            <ToolOutlined />
            <span>{t.toggleMaintenanceBtn}</span>
          </div>
        }
        open={maintenanceModalOpen}
        onCancel={() => setMaintenanceModalOpen(false)}
        onOk={handleConfirmMaintenanceToggle}
        confirmLoading={maintaining}
        okText={t.confirm}
        cancelText={t.cancel}
      >
        <div className="space-y-3 py-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {language === 'vi'
              ? `Phòng ${selectedMaintenanceRoom?.name} sẽ được chuyển sang trạng thái ${
                  selectedMaintenanceRoom?.status === 'MAINTENANCE' ? 'ĐANG HOẠT ĐỘNG' : 'ĐANG BẢO TRÌ'
                }. Hành động sẽ được ghi nhận vào Audit Log.`
              : `Room ${selectedMaintenanceRoom?.name} will be set to ${
                  selectedMaintenanceRoom?.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE'
                }. This action will be logged in system audit.`}
          </p>
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              {t.maintenanceReasonPrompt}
            </label>
            <Input.TextArea
              rows={3}
              value={maintenanceReason}
              onChange={(e) => setMaintenanceReason(e.target.value)}
              placeholder={t.maintenanceReasonPlaceholder}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
