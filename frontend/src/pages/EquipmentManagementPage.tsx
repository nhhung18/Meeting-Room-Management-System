import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Input,
  Select,
  Tag,
  Button,
  Typography,
  Space,
  Drawer,
  Form,
  Popconfirm,
  App,
  Spin,
  Empty,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  AppstoreOutlined,
  EnvironmentOutlined,
  BarcodeOutlined,
} from '@ant-design/icons';
import {
  EquipmentItem,
  EquipmentStatus,
  EQUIPMENT_STATUS_CONFIG,
  STANDARD_EQUIPMENT,
  Room,
} from '../types';
import {
  getEquipmentList,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  getRooms,
} from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const { Title, Text } = Typography;
const { Search } = Input;

export const EquipmentManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { t, language } = useLanguage();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [roomFilter, setRoomFilter] = useState<number | 'ALL' | 'UNASSIGNED'>('ALL');

  // Drawer states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form] = Form.useForm();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [eqData, roomsData] = await Promise.all([
        getEquipmentList({
          q: searchQuery,
          category: categoryFilter,
          status: statusFilter,
          roomId: roomFilter,
        }),
        getRooms(),
      ]);
      setEquipment(eqData);
      setRooms(roomsData.items);
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Error fetching equipment');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchQuery, categoryFilter, statusFilter, roomFilter]);

  // Overall metric stats
  const metrics = useMemo(() => {
    const total = equipment.length;
    const functional = equipment.filter((e) => e.status === 'FUNCTIONAL').length;
    const underRepair = equipment.filter((e) => e.status === 'UNDER_REPAIR').length;
    const unassigned = equipment.filter((e) => !e.room_id).length;
    return { total, functional, underRepair, unassigned };
  }, [equipment]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      category: STANDARD_EQUIPMENT[0],
      status: 'FUNCTIONAL',
      room_ids: [],
    });
    setDrawerOpen(true);
  };

  const handleOpenEdit = (item: EquipmentItem) => {
    setEditingItem(item);
    const currentRoomIds = item.room_ids && item.room_ids.length > 0
      ? item.room_ids
      : (item.room_id ? [item.room_id] : []);
    form.setFieldsValue({
      name: item.name,
      category: item.category,
      status: item.status,
      room_ids: currentRoomIds,
      serial_number: item.serial_number || '',
      notes: item.notes || '',
    });
    setDrawerOpen(true);
  };

  const handleDelete = async (item: EquipmentItem) => {
    try {
      await deleteEquipment(item.id);
      message.success(t.deleteEquipmentSuccess);
      fetchData();
    } catch (err: any) {
      message.error(err.message || 'Error deleting equipment');
    }
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const selectedRoomIds: number[] = values.room_ids || [];
      const selectedRooms = rooms.filter((r) => selectedRoomIds.includes(r.id));
      const primaryRoom = selectedRooms[0];

      if (editingItem) {
        await updateEquipment(editingItem.id, {
          name: values.name.trim(),
          category: values.category,
          status: values.status,
          room_ids: selectedRoomIds,
          room_names: selectedRooms.map((r) => r.name),
          room_id: primaryRoom ? primaryRoom.id : null,
          room_name: primaryRoom ? primaryRoom.name : null,
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
          room_id: primaryRoom ? primaryRoom.id : null,
          room_name: primaryRoom ? primaryRoom.name : null,
          serial_number: values.serial_number?.trim() || undefined,
          notes: values.notes?.trim() || undefined,
        });
        message.success(t.addEquipmentSuccess);
      }

      setDrawerOpen(false);
      fetchData();
    } catch (err: any) {
      if (!err?.errorFields) {
        message.error(err.message || 'Error saving equipment');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700, color: isDark ? '#f8fafc' : '#141b54' }}>
            {t.equipmentManagement}
          </Title>
          <Text type="secondary" style={{ fontSize: 13, color: isDark ? '#94a3b8' : undefined }}>
            {t.equipmentSubtitle}
          </Text>
        </div>

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
          style={{
            backgroundColor: isDark ? '#0a84ff' : '#1e40af',
            borderColor: isDark ? '#0a84ff' : '#1e40af',
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          {t.addNewEquipmentBtn}
        </Button>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`p-3.5 rounded-xl border ${
          isDark ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-slate-200'
        }`}>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{language === 'vi' ? 'Tổng thiết bị' : 'Total Devices'}</div>
          <div className="text-xl font-bold text-slate-800 dark:text-white mt-1 font-mono">{metrics.total}</div>
        </div>

        <div className={`p-3.5 rounded-xl border ${
          isDark ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-slate-200'
        }`}>
          <div className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider">{language === 'vi' ? 'Hoạt động tốt' : 'Functional'}</div>
          <div className="text-xl font-bold text-emerald-500 mt-1 font-mono">{metrics.functional}</div>
        </div>

        <div className={`p-3.5 rounded-xl border ${
          isDark ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-slate-200'
        }`}>
          <div className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider">{language === 'vi' ? 'Bảo dưỡng / Sửa' : 'Under Repair'}</div>
          <div className="text-xl font-bold text-amber-500 mt-1 font-mono">{metrics.underRepair}</div>
        </div>

        <div className={`p-3.5 rounded-xl border ${
          isDark ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-slate-200'
        }`}>
          <div className="text-[11px] font-semibold text-cyan-500 uppercase tracking-wider">{language === 'vi' ? 'Trong kho dự phòng' : 'In Storage'}</div>
          <div className="text-xl font-bold text-cyan-500 mt-1 font-mono">{metrics.unassigned}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className={`p-4 rounded-2xl border transition-colors ${
        isDark ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-slate-200'
      }`}>
        <Row gutter={[10, 10]} align="middle">
          <Col xs={24} md={8}>
            <Search
              placeholder={language === 'vi' ? 'Tìm theo tên, mã tài sản, sê-ri...' : 'Search by name, asset tag, serial...'}
              allowClear
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              prefix={<SearchOutlined className="text-slate-400" />}
              style={{ width: '100%' }}
            />
          </Col>

          <Col xs={12} md={5}>
            <Select
              value={categoryFilter}
              onChange={(val) => setCategoryFilter(val)}
              style={{ width: '100%' }}
              options={[
                { value: 'ALL', label: language === 'vi' ? 'Tất cả loại thiết bị' : 'All Categories' },
                ...STANDARD_EQUIPMENT.map((eq) => ({ value: eq, label: eq })),
              ]}
            />
          </Col>

          <Col xs={12} md={5}>
            <Select
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              style={{ width: '100%' }}
              options={[
                { value: 'ALL', label: language === 'vi' ? 'Tất cả tình trạng' : 'All Statuses' },
                { value: 'FUNCTIONAL', label: language === 'vi' ? 'Hoạt động tốt' : 'Functional' },
                { value: 'UNDER_REPAIR', label: language === 'vi' ? 'Đang bảo dưỡng' : 'Under Repair' },
                { value: 'DECOMMISSIONED', label: language === 'vi' ? 'Ngừng sử dụng' : 'Decommissioned' },
              ]}
            />
          </Col>

          <Col xs={24} md={6}>
            <Select
              value={roomFilter}
              onChange={(val) => setRoomFilter(val)}
              style={{ width: '100%' }}
              options={[
                { value: 'ALL', label: language === 'vi' ? 'Tất cả vị trí' : 'All Locations' },
                { value: 'UNASSIGNED', label: t.unassignedStorage },
                ...rooms.map((r) => ({ value: r.id, label: r.name })),
              ]}
            />
          </Col>
        </Row>
      </div>

      {/* Main Content: Card Grid */}
      {loading ? (
        <div className={`py-16 text-center rounded-2xl border ${isDark ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-slate-200'}`}>
          <Spin size="large" />
        </div>
      ) : equipment.length === 0 ? (
        <div className={`p-10 rounded-2xl border text-center ${isDark ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-slate-200'}`}>
          <Empty
            description={language === 'vi' ? 'Không tìm thấy thiết bị phù hợp' : 'No equipment found matching criteria'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={handleOpenCreate} style={{ backgroundColor: isDark ? '#0a84ff' : '#1e40af' }}>
              {t.addNewEquipmentBtn}
            </Button>
          </Empty>
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {equipment.map((item) => {
            const statusCfg = EQUIPMENT_STATUS_CONFIG[item.status];
            return (
              <Col xs={24} sm={12} lg={8} key={item.id}>
                <div className={`h-full flex flex-col justify-between rounded-2xl p-4 border transition-all ${
                  isDark
                    ? 'bg-[#1c1c1e] border-white/10 hover:border-[#0a84ff]'
                    : 'bg-white border-slate-200 shadow-2xs hover:border-[#1e40af]'
                }`}>
                  <div>
                    {/* Header: ID & Status */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/10">
                        {item.id}
                      </span>
                      <Tag color={statusCfg.color} className="m-0 font-medium text-xs">
                        {language === 'vi' ? statusCfg.label : statusCfg.labelEn}
                      </Tag>
                    </div>

                    {/* Device Name */}
                    <div className="font-bold text-base text-slate-800 dark:text-white line-clamp-1 mb-1">
                      {item.name}
                    </div>

                    {/* Category */}
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
                      <ToolOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
                      <span>{item.category}</span>
                    </div>

                    {/* Location / Assigned Room(s) */}
                    {(() => {
                      const assignedIds = item.room_ids && item.room_ids.length > 0
                        ? item.room_ids
                        : (item.room_id ? [item.room_id] : []);
                      const assignedNames = item.room_names && item.room_names.length > 0
                        ? item.room_names
                        : (item.room_name ? [item.room_name] : []);

                      if (assignedIds.length > 1) {
                        return (
                          <div className={`p-2.5 rounded-lg border text-xs mb-3 ${
                            isDark ? 'bg-cyan-950/20 border-cyan-800/30' : 'bg-cyan-50/60 border-cyan-100'
                          }`}>
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <Tag color="cyan" className="m-0 font-semibold text-[11px]">
                                {t.sharedEquipmentBadge} ({assignedIds.length})
                              </Tag>
                              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">
                                {t.sharedAcrossRooms}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {assignedIds.map((rid, idx) => (
                                <button
                                  key={rid}
                                  type="button"
                                  onClick={() => navigate(`/rooms/${rid}`)}
                                  className="text-[11px] px-1.5 py-0.5 rounded border transition-all cursor-pointer bg-white dark:bg-white/10 border-slate-200 dark:border-white/15 text-[#1e40af] dark:text-[#64d2ff] hover:underline flex items-center gap-1 font-medium"
                                >
                                  <EnvironmentOutlined style={{ fontSize: 10 }} />
                                  <span>{assignedNames[idx] || `Phòng #${rid}`}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className={`p-2 rounded-lg border text-xs mb-3 flex items-center justify-between ${
                          assignedIds.length === 1
                            ? isDark ? 'bg-white/5 border-white/10' : 'bg-blue-50/50 border-blue-100'
                            : isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <EnvironmentOutlined className={assignedIds.length === 1 ? 'text-[#1e40af] dark:text-[#0a84ff]' : 'text-slate-400'} />
                            <span className="truncate font-medium text-slate-700 dark:text-zinc-200">
                              {assignedNames[0] || t.unassignedStorage}
                            </span>
                          </div>
                          {assignedIds.length === 1 && (
                            <button
                              type="button"
                              onClick={() => navigate(`/rooms/${assignedIds[0]}`)}
                              className="text-[11px] text-[#1e40af] dark:text-[#0a84ff] hover:underline font-medium shrink-0 ml-1 cursor-pointer"
                            >
                              {t.viewDetails} &rarr;
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {/* Serial & Notes */}
                    <div className="space-y-1 text-xs text-slate-400">
                      {item.serial_number && (
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <BarcodeOutlined />
                          <span>{item.serial_number}</span>
                        </div>
                      )}
                      {item.notes && (
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2 italic m-0">
                          "{item.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-end gap-2 mt-4">
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleOpenEdit(item)}
                      style={{ borderRadius: 6 }}
                    >
                      {language === 'vi' ? 'Sửa' : 'Edit'}
                    </Button>

                    <Popconfirm
                      title={t.deleteEquipmentConfirmTitle}
                      description={t.deleteEquipmentConfirmDesc}
                      okText={t.confirm}
                      cancelText={t.cancel}
                      okType="danger"
                      onConfirm={() => handleDelete(item)}
                    >
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        style={{ borderRadius: 6 }}
                      />
                    </Popconfirm>
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Create / Edit Drawer */}
      <Drawer
        title={editingItem ? (language === 'vi' ? 'Chỉnh sửa thiết bị' : 'Edit Equipment') : t.addNewEquipmentBtn}
        placement="right"
        size={460}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        styles={{
          body: {
            backgroundColor: isDark ? '#18181b' : '#ffffff',
          },
          header: {
            backgroundColor: isDark ? '#18181b' : '#ffffff',
            borderColor: isDark ? '#27272a' : '#e2e8f0',
          },
        }}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={handleFormSubmit}
        >
          <Form.Item
            name="name"
            label={<span className="font-medium text-xs text-slate-600 dark:text-zinc-300">{t.equipmentName}</span>}
            rules={[{ required: true, message: language === 'vi' ? 'Vui lòng nhập tên thiết bị' : 'Please enter equipment name' }]}
          >
            <Input placeholder={language === 'vi' ? 'VD: Sony Bravia 85" 4K HDR Pro' : 'e.g. Sony Bravia 85" 4K Display'} />
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
                  ? 'Có thể chọn nhiều phòng nếu là thiết bị dùng chung (VD: TV di động, máy chiếu di động)'
                  : 'Select multiple rooms if shared across rooms (e.g. mobile TV, portable projector)'}
              </span>
            }
          >
            <Select
              mode="multiple"
              allowClear
              placeholder={t.selectMultipleRoomsPlaceholder}
              options={rooms.map((r) => ({
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
            <Input.TextArea rows={3} placeholder={language === 'vi' ? 'Thông tin bảo hành, tình trạng hoặc cấu hình đặc biệt...' : 'Warranty, configuration or hardware details...'} />
          </Form.Item>

          <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-2">
            <Button onClick={() => setDrawerOpen(false)}>
              {t.cancel}
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              style={{
                backgroundColor: isDark ? '#0a84ff' : '#1e40af',
                borderColor: isDark ? '#0a84ff' : '#1e40af',
                borderRadius: 8,
              }}
            >
              {editingItem ? t.saveChangesSubmitBtn : t.confirm}
            </Button>
          </div>
        </Form>
      </Drawer>
    </div>
  );
};
export default EquipmentManagementPage;
