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
  Pagination,
  Empty,
  Spin,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  TeamOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  AppstoreOutlined,
  PictureOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { Room, RoomStatus, ROOM_STATUS_CONFIG, STANDARD_EQUIPMENT, getRoomStatusLabel, getEquipmentLabel } from '../types';
import { getRooms } from '../api/client';
import { ApiErrorState } from '../components/ApiErrorState';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const { Title, Text } = Typography;
const { Search } = Input;

export const RoomListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number; detail: string } | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RoomStatus | 'ALL'>('ALL');
  const [capacityFilter, setCapacityFilter] = useState<number>(0);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const fetchRoomList = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getRooms({
        q: searchQuery,
        status: statusFilter,
        minCapacity: capacityFilter,
        equipment: selectedEquipment,
      });
      setRooms(res.items);
    } catch (err: any) {
      setError({
        status: err.status ?? 0,
        detail: err.detail || err.message || (language === 'vi' ? 'Không thể tải danh sách phòng họp' : 'Failed to load rooms list'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomList();
  }, [searchQuery, statusFilter, capacityFilter, selectedEquipment]);

  // Handle Tag toggle for equipment
  const handleEquipmentToggle = (item: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(item) ? prev.filter((t) => t !== item) : [...prev, item]
    );
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setCapacityFilter(0);
    setSelectedEquipment([]);
    setCurrentPage(1);
  };

  // Paginated slices for card view
  const paginatedRooms = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return rooms.slice(startIndex, startIndex + pageSize);
  }, [rooms, currentPage, pageSize]);

  return (
    <div className="space-y-4 max-w-full">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700, color: isDark ? '#f8fafc' : '#141b54' }}>
            {t.roomListTitle}
          </Title>
          <Text type="secondary" style={{ fontSize: 13, color: isDark ? '#94a3b8' : undefined }}>
            {t.roomListSubtitle}
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-zinc-200 border border-slate-200 dark:border-white/10">
            {rooms.length} {t.totalRoomsUnit}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-colors ${
        isDark ? 'bg-[#1c1c1e] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <div className="space-y-3">
          {/* Row 1: Search, Status, Capacity, Reset */}
          <Row gutter={[10, 10]} align="middle">
            <Col xs={24} md={10}>
              <Search
                placeholder={t.filterSearchPlaceholder}
                allowClear
                enterButton={<SearchOutlined />}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ width: '100%' }}
              />
            </Col>

            <Col xs={12} md={6}>
              <Select
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setCurrentPage(1);
                }}
                style={{ width: '100%' }}
                options={[
                  { value: 'ALL', label: t.allStatuses },
                  { value: 'AVAILABLE', label: t.statusAvailable },
                  { value: 'MAINTENANCE', label: t.statusMaintenance },
                  { value: 'ARCHIVED', label: t.statusArchived },
                ]}
              />
            </Col>

            <Col xs={12} md={5}>
              <Select
                value={capacityFilter}
                onChange={(val) => {
                  setCapacityFilter(val);
                  setCurrentPage(1);
                }}
                style={{ width: '100%' }}
                options={[
                  { value: 0, label: t.filterCapacityAll },
                  { value: 5, label: `≥ 5 ${t.peopleUnit}` },
                  { value: 10, label: `≥ 10 ${t.peopleUnit}` },
                  { value: 20, label: `≥ 20 ${t.peopleUnit}` },
                  { value: 30, label: `≥ 30 ${t.peopleUnit}` },
                ]}
              />
            </Col>

            <Col xs={24} md={3} className="text-right flex justify-end">
              <Tooltip title={t.resetFilterTooltip}>
                <Button icon={<ReloadOutlined />} onClick={handleResetFilters} block className="sm:w-auto">
                  {t.clearFilters}
                </Button>
              </Tooltip>
            </Col>
          </Row>

          {/* Row 2: Equipment Tags Filter */}
          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto overflow-y-hidden pb-1">
            <Text type="secondary" className="text-xs shrink-0 font-medium">
              {t.filterEquipmentLabel}
            </Text>
            <div className="flex items-center gap-1.5 shrink-0">
              {STANDARD_EQUIPMENT.slice(0, 5).map((eq) => {
                const isChecked = selectedEquipment.includes(eq);
                return (
                  <Tag.CheckableTag
                    key={eq}
                    checked={isChecked}
                    onChange={() => handleEquipmentToggle(eq)}
                    style={{
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontSize: 12,
                      border: isChecked
                        ? (isDark ? '1px solid #0a84ff' : '1px solid #1e40af')
                        : (isDark ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid #d9d9d9'),
                      backgroundColor: isChecked
                        ? (isDark ? 'rgba(10, 132, 255, 0.22)' : '#eff6ff')
                        : (isDark ? '#242426' : undefined),
                      color: isChecked
                        ? (isDark ? '#64d2ff' : '#1e40af')
                        : (isDark ? '#a1a1a6' : undefined),
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getEquipmentLabel(eq, language)}
                  </Tag.CheckableTag>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: 100% Card View Grid (No Table) */}
      {error ? (
        <ApiErrorState error={error} onRetry={fetchRoomList} />
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
            <Button type="primary" onClick={handleResetFilters} style={{ backgroundColor: isDark ? '#0a84ff' : '#1e40af', borderColor: isDark ? '#0a84ff' : '#1e40af' }}>
              {t.clearFilters}
            </Button>
          </Empty>
        </div>
      ) : (
        <>
          {/* Card View Grid: 3 cols desktop, 2 tablet, 1 mobile */}
          <Row gutter={[16, 16]}>
            {paginatedRooms.map((room) => {
              const statusCfg = ROOM_STATUS_CONFIG[room.status];
              const isAvailable = room.status === 'AVAILABLE';
              const isMaintenanceBlocked = room.status === 'MAINTENANCE' && user?.role === 'EMPLOYEE';

              return (
                <Col xs={24} sm={12} lg={8} key={room.id}>
                  <div
                    className={`h-full flex flex-col justify-between rounded-2xl p-4 border transition-all ${
                      isMaintenanceBlocked
                        ? isDark ? 'bg-[#18181a] border-amber-500/30' : 'bg-slate-50/80 border-amber-300'
                        : isDark
                        ? 'bg-[#1c1c1e] border-white/15 hover:border-[#0a84ff] hover:bg-[#242426]'
                        : 'bg-white border-slate-200 shadow-2xs hover:border-[#1e40af]'
                    }`}
                  >
                    <div>
                      {/* Ô div để add ảnh phòng sau này - Vô hiệu hóa khi phòng đang bảo trì đối với Employee */}
                      <div
                        onClick={() => {
                          if (!isMaintenanceBlocked) {
                            navigate(`/rooms/${room.id}`);
                          }
                        }}
                        className={`w-full h-36 rounded-xl mb-3 border border-dashed flex flex-col items-center justify-center relative overflow-hidden transition-all ${
                          isMaintenanceBlocked
                            ? 'cursor-not-allowed bg-amber-500/10 border-amber-500/40'
                            : isDark
                            ? 'bg-[#242426] border-white/15 hover:border-[#0a84ff] cursor-pointer group'
                            : 'bg-slate-50 border-slate-200 hover:border-[#1e40af] cursor-pointer group'
                        }`}
                      >
                        {isMaintenanceBlocked ? (
                          <div className="absolute inset-0 bg-amber-950/20 dark:bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-3 text-center z-10">
                            <span className="text-amber-500 dark:text-amber-400 font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
                              <ToolOutlined /> {t.statusMaintenance}
                            </span>
                            <span className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium leading-snug px-2">
                              {t.roomMaintenanceBlocked}
                            </span>
                          </div>
                        ) : null}

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

                      {/* Capacity & Status Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-medium flex items-center gap-1 ${
                          isDark ? 'bg-white/5 text-zinc-200 border border-white/10' : 'bg-slate-100 text-slate-700'
                        }`}>
                          <TeamOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
                          <span>{room.capacity} {t.peopleUnit}</span>
                        </span>

                        <Tag color={statusCfg.color} className="m-0 font-medium">
                          {getRoomStatusLabel(room.status, language)}
                        </Tag>
                      </div>

                      {/* Room Name - Disable click if maintenance blocked */}
                      <div
                        className={`font-bold text-base transition-colors line-clamp-1 mb-1 ${
                          isMaintenanceBlocked
                            ? 'text-slate-400 dark:text-zinc-500 cursor-not-allowed'
                            : 'cursor-pointer hover:text-[#1e40af] dark:hover:text-[#0a84ff]'
                        }`}
                        onClick={() => {
                          if (!isMaintenanceBlocked) {
                            navigate(`/rooms/${room.id}`);
                          }
                        }}
                      >
                        {room.name}
                      </div>

                      {/* Room Location Info */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-3">
                        <EnvironmentOutlined className="text-[#1e40af] dark:text-[#0a84ff] shrink-0" />
                        <span className="text-slate-400 shrink-0">{t.locationLabel}</span>
                        <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                          {room.floor || t.defaultRoomFloor}
                        </span>
                      </div>

                      {/* Equipment List with Tooltip */}
                      <div className="mb-4">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                          {t.equipmentCount} ({room.equipment.length}):
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
                                +{room.equipment.length - 3} {t.otherEquipmentCount}
                              </span>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between mt-auto">
                      <Button
                        type="link"
                        size="small"
                        disabled={isMaintenanceBlocked}
                        onClick={() => {
                          if (!isMaintenanceBlocked) {
                            navigate(`/rooms/${room.id}`);
                          }
                        }}
                        style={{
                          paddingLeft: 0,
                          color: isMaintenanceBlocked ? undefined : (isDark ? '#0a84ff' : '#1e40af'),
                          fontWeight: 500,
                        }}
                      >
                        {t.roomDetailsBtn}
                      </Button>

                      <Button
                        type="primary"
                        size="small"
                        disabled={!isAvailable}
                        onClick={() => navigate(`/rooms/${room.id}/book`)}
                        style={isAvailable ? { backgroundColor: isDark ? '#0a84ff' : '#1e40af', borderColor: isDark ? '#0a84ff' : '#1e40af', borderRadius: 6, fontWeight: 500 } : {}}
                      >
                        {isAvailable ? t.roomBookNowBtn : t.roomUnderMaintenanceBtn}
                      </Button>
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>

          {/* Pagination bottom-right */}
          <div className="flex justify-end pt-3">
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={rooms.length}
              onChange={(page, size) => {
                setCurrentPage(page);
                setPageSize(size);
              }}
              showTotal={(total) => `${language === 'vi' ? 'Tổng cộng' : 'Total'} ${total} ${t.totalRoomsUnit}`}
              showSizeChanger
              pageSizeOptions={['6', '9', '12', '24']}
            />
          </div>
        </>
      )}
    </div>
  );
};
