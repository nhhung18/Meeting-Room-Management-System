import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Tag,
  DatePicker,
  Typography,
  Space,
  Empty,
  App,
  Tooltip,
  Pagination,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  FileTextOutlined,
  DownloadOutlined,
  SearchOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  UserOutlined,
  SafetyOutlined,
  FilterOutlined,
  RightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { AuditLogEntry, AuditActionType } from '../types';
import { getAuditLogs, exportAuditLogsToCsv } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { ApiErrorState } from '../components/ApiErrorState';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const AuditLogPage: React.FC = () => {
  const { isDark } = useTheme();
  const { t, language } = useLanguage();
  const { isMobile } = useBreakpoint();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number; detail: string } | null>(null);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  // Mobile pagination
  const [mobilePage, setMobilePage] = useState(1);
  const mobilePageSize = 8;

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAuditLogs({
        q: searchQuery,
        actionType: actionFilter,
        startDate: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
        endDate: dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
      });
      setLogs(data);
    } catch (err: any) {
      setError({
        status: err.status ?? 0,
        detail: err.detail || err.message || (language === 'vi' ? 'Lỗi khi tải nhật ký hoạt động' : 'Error loading audit logs'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [searchQuery, actionFilter, dateRange]);

  const handleExport = () => {
    if (logs.length === 0) {
      message.warning(language === 'vi' ? 'Không có dữ liệu log để xuất' : 'No logs to export');
      return;
    }
    exportAuditLogsToCsv(logs);
    message.success(t.exportCsvSuccess);
  };

  const getActionTag = (action: AuditActionType) => {
    switch (action) {
      case 'USER_ROLE_CHANGED':
        return <Tag color="purple">{language === 'vi' ? 'Đổi vai trò' : 'Role Changed'}</Tag>;
      case 'USER_STATUS_TOGGLED':
        return <Tag color="orange">{language === 'vi' ? 'Khóa/Mở tài khoản' : 'Status Toggled'}</Tag>;
      case 'USER_CREATED':
        return <Tag color="green">{language === 'vi' ? 'Tạo người dùng' : 'User Created'}</Tag>;
      case 'ROOM_FORCE_RELEASED':
        return <Tag color="red">{language === 'vi' ? 'Giải phóng cưỡng chế' : 'Force Released'}</Tag>;
      case 'ROOM_MAINTENANCE_TOGGLED':
        return <Tag color="gold">{language === 'vi' ? 'Đổi trạng thái bảo trì' : 'Maintenance'}</Tag>;
      case 'BOOKING_FORCE_CANCELLED':
        return <Tag color="volcano">{language === 'vi' ? 'Cưỡng chế hủy lịch' : 'Force Cancelled'}</Tag>;
      case 'POLICY_CONFIG_UPDATED':
        return <Tag color="blue">{language === 'vi' ? 'Đổi quy định hệ thống' : 'Policy Updated'}</Tag>;
      case 'EQUIPMENT_ALLOCATED':
        return <Tag color="cyan">{language === 'vi' ? 'Phân bổ thiết bị' : 'Equipment Assigned'}</Tag>;
      default:
        return <Tag>{action}</Tag>;
    }
  };

  const columns: ColumnsType<AuditLogEntry> = [
    {
      title: t.colLogTime,
      key: 'timestamp',
      width: 170,
      render: (_, record) => (
        <div className="font-mono tabular-nums text-xs text-slate-600 dark:text-slate-300">
          <div>{dayjs(record.timestamp).format('YYYY-MM-DD')}</div>
          <div className="text-[11px] text-slate-400">{dayjs(record.timestamp).format('HH:mm:ss')}</div>
        </div>
      ),
    },
    {
      title: t.colLogActor,
      key: 'actor',
      width: 200,
      render: (_, record) => (
        <div>
          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {record.actor_name}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
            <span className="font-mono text-[11px]">{record.actor_role}</span>
            {record.ip_address && (
              <>
                <span>·</span>
                <span className="font-mono text-[11px]">{record.ip_address}</span>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      title: t.colLogAction,
      key: 'action_type',
      width: 190,
      render: (_, record) => getActionTag(record.action_type),
    },
    {
      title: t.colLogTarget,
      key: 'target',
      width: 200,
      render: (_, record) => (
        <div className="text-xs">
          <div className="font-medium text-slate-700 dark:text-slate-200 truncate">
            {record.target_name || '—'}
          </div>
          {record.target_id && (
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              ID: {record.target_id}
            </div>
          )}
        </div>
      ),
    },
    {
      title: t.colLogDetails,
      key: 'details',
      render: (_, record) => (
        <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {record.details}
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <ApiErrorState
          error={error}
          onRetry={fetchLogs}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <Title level={3} className="!mb-1 tracking-tight">
            {t.auditLogs}
          </Title>
          <Text className="text-slate-500 dark:text-slate-400 text-sm">
            {t.auditLogsSubtitle}
          </Text>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchLogs}
            loading={loading}
            className="shrink-0"
            title={t.refreshData}
          >
            <span className="hidden sm:inline">{t.refreshData}</span>
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            className="flex-1 sm:flex-none justify-center bg-emerald-600 hover:bg-emerald-500 border-none font-medium"
          >
            {t.exportCsvBtn}
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-[#1c1c1e] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="flex-1 w-full lg:max-w-md">
          <Input
            placeholder={language === 'vi' ? 'Tìm theo người thao tác, đối tượng, nội dung log...' : 'Search logs by actor, target, details...'}
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full lg:w-auto lg:flex lg:flex-wrap lg:items-center">
          {/* Action Filter */}
          <Select
            value={actionFilter}
            onChange={setActionFilter}
            className="w-full lg:w-[220px]"
            options={[
              { value: 'ALL', label: `${t.filterActionLabel}: ${t.all}` },
              { value: 'USER_ROLE_CHANGED', label: language === 'vi' ? 'Đổi vai trò người dùng' : 'Role Changed' },
              { value: 'USER_STATUS_TOGGLED', label: language === 'vi' ? 'Khóa/Mở tài khoản' : 'Status Toggled' },
              { value: 'USER_CREATED', label: language === 'vi' ? 'Tạo người dùng mới' : 'User Created' },
              { value: 'ROOM_FORCE_RELEASED', label: language === 'vi' ? 'Giải phóng phòng cưỡng chế' : 'Force Released' },
              { value: 'ROOM_MAINTENANCE_TOGGLED', label: language === 'vi' ? 'Bảo trì phòng' : 'Maintenance' },
              { value: 'POLICY_CONFIG_UPDATED', label: language === 'vi' ? 'Cập nhật quy định' : 'Policy Updated' },
              { value: 'EQUIPMENT_ALLOCATED', label: language === 'vi' ? 'Phân bổ thiết bị' : 'Equipment Assigned' },
            ]}
          />

          {/* Date Range Filter */}
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder={[language === 'vi' ? 'Từ ngày' : 'Start date', language === 'vi' ? 'Đến ngày' : 'End date']}
            className="w-full lg:w-[250px]"
          />
        </div>
      </div>

      {/* Content: Mobile Cards (< 768px) vs Desktop Table (>= 768px) */}
      {isMobile ? (
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="bg-white dark:bg-[#1c1c1e] p-8 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
              <Empty
                description={
                  <span className="text-slate-500">{t.emptyAuditLogs}</span>
                }
              />
            </div>
          ) : (
            logs
              .slice((mobilePage - 1) * mobilePageSize, mobilePage * mobilePageSize)
              .map((record) => (
                <div
                  key={record.id}
                  className={`p-4 rounded-xl border transition-colors space-y-2.5 ${
                    isDark ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-slate-200 shadow-2xs'
                  }`}
                >
                  {/* Top row: Action Tag + Timestamp */}
                  <div className="flex items-center justify-between gap-2">
                    <div>{getActionTag(record.action_type)}</div>
                    <div className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <ClockCircleOutlined className="text-[11px]" />
                      <span>{dayjs(record.timestamp).format('YYYY-MM-DD HH:mm:ss')}</span>
                    </div>
                  </div>

                  {/* Actor & IP */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <UserOutlined className="text-[#1e40af] dark:text-[#0a84ff] shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {record.actor_name}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                        ({record.actor_role})
                      </span>
                    </div>
                    {record.ip_address && (
                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                        IP: {record.ip_address}
                      </span>
                    )}
                  </div>

                  {/* Target Entity */}
                  {record.target_name && (
                    <div
                      className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                        isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-slate-400 shrink-0">{t.colLogTarget}:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                          {record.target_name}
                        </span>
                      </div>
                      {record.target_id && (
                        <span className="font-mono text-[10px] text-slate-400 shrink-0">
                          #{record.target_id}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Details Block */}
                  <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50/70 dark:bg-white/[0.03] p-2.5 rounded-lg border border-slate-100 dark:border-white/5">
                    {record.details}
                  </div>

                  {/* Footer Log ID */}
                  <div className="text-[10px] font-mono text-slate-400 flex justify-end">
                    Log #{record.id}
                  </div>
                </div>
              ))
          )}

          {/* Mobile Pagination */}
          {logs.length > mobilePageSize && (
            <div className="flex justify-center pt-2 pb-4">
              <Pagination
                size="small"
                current={mobilePage}
                pageSize={mobilePageSize}
                total={logs.length}
                onChange={setMobilePage}
                showSizeChanger={false}
              />
            </div>
          )}
        </div>
      ) : (
        /* Desktop Table View */
        <div className="bg-white dark:bg-[#1c1c1e] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <Table<AuditLogEntry>
            rowKey="id"
            columns={columns}
            dataSource={logs}
            loading={loading}
            scroll={{ x: 800 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              showTotal: (total) => `${total} ${language === 'vi' ? 'bản ghi' : 'records'}`,
            }}
            locale={{
              emptyText: (
                <Empty
                  description={
                    <span className="text-slate-500">{t.emptyAuditLogs}</span>
                  }
                />
              ),
            }}
          />
        </div>
      )}
    </div>
  );
};
