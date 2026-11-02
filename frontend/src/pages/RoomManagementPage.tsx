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
  Empty,
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
} from '@ant-design/icons';
import { Room, RoomStatus, ROOM_STATUS_CONFIG, STANDARD_EQUIPMENT, getRoomStatusLabel, getEquipmentLabel } from '../types';
import { getRooms, createRoom, updateRoom, deleteRoom, forceReleaseRoom, toggleRoomMaintenance } from '../api/client';
import { ApiErrorState } from '../components/ApiErrorState';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const { Title, Text } = Typography;
const { Search } = Input;

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
        <div className={`p-8 rounded-2xl border text-center ${isDark ? 'bg-[#1c1c1e] border-white/15' : 'bg-white border-slate-200'}`}>
          <Empty
            description={t.emptyRooms || t.noRoomsFound}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={handleOpenCreate} style={{ backgroundColor: isDark ? '#0a84ff' : '#1e40af', borderColor: isDark ? '#0a84ff' : '#1e40af' }}>
              {t.addNewRoomBtn}
            </Button>
          </Empty>
        </div>
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
        title={
          <span className="font-bold text-base">
            {editingRoom ? `${t.drawerEditRoomTitle}: ${editingRoom.name}` : t.drawerCreateRoomTitle}
          </span>
        }
        placement="right"
        size={typeof window !== 'undefined' && window.innerWidth < 768 ? '100%' : 480}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        styles={{
          body: {
            backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
          },
          header: {
            backgroundColor: isDark ? '#242426' : '#ffffff',
            borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #f1f5f9',
          },
        }}
        footer={
          <div className="flex items-center justify-end gap-2 py-1">
            <Button onClick={() => setDrawerOpen(false)} style={{ borderRadius: 6 }}>
              {t.cancel}
            </Button>
            <Button
              type="primary"
              loading={submitting}
              onClick={handleFormSubmit}
              style={{
                backgroundColor: isDark ? '#0a84ff' : '#1e40af',
                borderColor: isDark ? '#0a84ff' : '#1e40af',
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              {editingRoom ? t.saveChangesSubmitBtn : t.createRoomSubmitBtn}
            </Button>
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
          className="space-y-3"
        >
          {/* Tên phòng */}
          <Form.Item
            label={<span className="font-semibold text-xs">{t.fieldName}</span>}
            name="name"
            rules={[{ required: true, message: t.errRequiredName }]}
          >
            <Input placeholder={t.fieldNamePlaceholder} size="large" />
          </Form.Item>

          {/* Sức chứa & Trạng thái */}
          <Row gutter={12}>
            <Col xs={12}>
              <Form.Item
                label={<span className="font-semibold text-xs">{t.fieldCapacityNumber}</span>}
                name="capacity"
                rules={[
                  { required: true, message: t.fieldCapacityNumber },
                  { type: 'number', min: 1, message: language === 'vi' ? 'Tối thiểu 1 người' : 'Min 1 person' },
                ]}
              >
                <InputNumber min={1} max={200} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>

            <Col xs={12}>
              <Form.Item
                label={<span className="font-semibold text-xs">{t.fieldStatus}</span>}
                name="status"
                rules={[{ required: true, message: t.fieldStatus }]}
              >
                <Select
                  size="large"
                  options={[
                    { value: 'AVAILABLE', label: t.statusAvailable },
                    { value: 'MAINTENANCE', label: t.statusMaintenance },
                    { value: 'ARCHIVED', label: t.statusArchived },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Vị trí / Tầng */}
          <Form.Item
            label={<span className="font-semibold text-xs">{t.fieldLocationFloor}</span>}
            name="floor"
          >
            <Input placeholder={t.fieldLocationFloorPlaceholder} size="large" />
          </Form.Item>

          {/* Quản lý phụ trách */}
          <Form.Item
            label={<span className="font-semibold text-xs">{t.fieldManagerInCharge}</span>}
            name="owner_id"
          >
            <Input placeholder={t.fieldManagerInChargePlaceholder} size="large" />
          </Form.Item>

          {/* Thiết bị sẵn có */}
          <Form.Item
            label={<span className="font-semibold text-xs">{t.fieldAvailableEquipment}</span>}
            name="equipment"
          >
            <Checkbox.Group className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {STANDARD_EQUIPMENT.map((eq) => (
                <Checkbox key={eq} value={eq} className="text-xs">
                  {getEquipmentLabel(eq, language)}
                </Checkbox>
              ))}
            </Checkbox.Group>
          </Form.Item>

          {/* Thêm thiết bị tùy chỉnh */}
          <div className="pt-2">
            <Text type="secondary" className="text-xs mb-1.5 block">
              {t.addCustomEquipmentLabel}
            </Text>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder={t.customEquipmentPlaceholder}
                value={customEquipment}
                onChange={(e) => setCustomEquipment(e.target.value)}
                onPressEnter={handleAddCustomEquipment}
              />
              <Button onClick={handleAddCustomEquipment} type="dashed">
                {t.addCustomEquipmentBtn}
              </Button>
            </Space.Compact>
          </div>
        </Form>
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
