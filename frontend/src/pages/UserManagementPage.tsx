import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Avatar,
  Typography,
  Popconfirm,
  Tooltip,
  Drawer,
  Form,
  Row,
  Col,
  App,
  Empty,
  Badge,
  Pagination,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UserOutlined,
  SearchOutlined,
  PlusOutlined,
  LockOutlined,
  UnlockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  PhoneOutlined,
  MailOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { UserAccount, UserRole } from '../types';
import { getUserAccounts, updateUserRole, toggleUserStatus, createUserAccount } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { ApiErrorState } from '../components/ApiErrorState';

const { Title, Text } = Typography;

export const UserManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { isDark } = useTheme();
  const { t, language } = useLanguage();
  const { isMobile } = useBreakpoint();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number; detail: string } | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'SUSPENDED' | 'ALL'>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  // Mobile pagination
  const [mobilePage, setMobilePage] = useState(1);
  const mobilePageSize = 6;

  // Add user drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUserAccounts({
        q: searchQuery,
        role: roleFilter,
        status: statusFilter,
        department: departmentFilter,
      });
      setUsers(data);
    } catch (err: any) {
      setError({
        status: err.status ?? 0,
        detail: err.detail || err.message || (language === 'vi' ? 'Lỗi khi tải danh sách người dùng' : 'Error loading users'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [searchQuery, roleFilter, statusFilter, departmentFilter]);

  // Extract unique departments for filter dropdown
  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.department) set.add(u.department);
    });
    return Array.from(set);
  }, [users]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!currentUser) return;
    try {
      await updateUserRole(userId, newRole, {
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
      });
      message.success(t.changeRoleSuccess);
      fetchUsers();
    } catch (err: any) {
      message.error(err.message || 'Error updating role');
    }
  };

  const handleToggleStatus = async (userId: string) => {
    if (!currentUser) return;
    try {
      await toggleUserStatus(userId, {
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
      });
      message.success(t.toggleStatusSuccess);
      fetchUsers();
    } catch (err: any) {
      message.error(err.message || 'Error updating status');
    }
  };

  const handleCreateUser = async (values: any) => {
    if (!currentUser) return;
    try {
      setSubmitting(true);
      await createUserAccount(
        {
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          role: values.role,
          department: values.department.trim(),
          phone: values.phone?.trim() || '',
          status: 'ACTIVE',
          avatar: values.avatar?.trim() || `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 500000)}?w=120&auto=format&fit=crop&q=80`,
        },
        {
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
        }
      );
      message.success(t.createUserSuccess);
      setDrawerOpen(false);
      form.resetFields();
      fetchUsers();
    } catch (err: any) {
      message.error(err.message || 'Error creating user');
    } finally {
      setSubmitting(false);
    }
  };

  const roleLabels: Record<UserRole, { label: string; color: string }> = {
    ADMINISTRATOR: { label: t.roleAdmin, color: '#ff4d4f' },
    ROOM_MANAGER: { label: t.roleManager, color: '#1890ff' },
    EMPLOYEE: { label: t.roleEmployee, color: '#52c41a' },
  };

  const columns: ColumnsType<UserAccount> = [
    {
      title: t.colUserInfo,
      key: 'userInfo',
      width: 280,
      render: (_, record) => {
        const isSelf = currentUser?.id === record.id;
        return (
          <div className="flex items-center gap-3">
            <Avatar
              size={42}
              src={record.avatar}
              icon={<UserOutlined />}
              className="shrink-0 border border-slate-200 dark:border-slate-700"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Text strong className="text-sm truncate">
                  {record.name}
                </Text>
                {isSelf && (
                  <Tag color="blue" className="text-xs mr-0">
                    {language === 'vi' ? 'Bạn' : 'You'}
                  </Tag>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                <MailOutlined className="text-[10px]" />
                <span className="truncate">{record.email}</span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: t.colUserDept,
      key: 'department',
      width: 240,
      render: (_, record) => (
        <div>
          <div className="text-sm text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <ApartmentOutlined className="text-slate-400" />
            <span>{record.department || '—'}</span>
          </div>
          {record.phone && (
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
              <PhoneOutlined className="text-[10px] text-slate-400" />
              <span className="font-mono tabular-nums">{record.phone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      title: t.colUserRole,
      key: 'role',
      width: 220,
      render: (_, record) => {
        const isSelf = currentUser?.id === record.id;
        return (
          <Tooltip title={isSelf ? t.cannotModifySelf : undefined}>
            <Select
              value={record.role}
              disabled={isSelf}
              style={{ width: 170 }}
              onChange={(val) => handleRoleChange(record.id, val)}
              options={[
                { value: 'ADMINISTRATOR', label: t.roleAdmin },
                { value: 'ROOM_MANAGER', label: t.roleManager },
                { value: 'EMPLOYEE', label: t.roleEmployee },
              ]}
              className="text-xs"
            />
          </Tooltip>
        );
      },
    },
    {
      title: t.colUserStatus,
      key: 'status',
      width: 150,
      render: (_, record) => {
        const isActive = record.status === 'ACTIVE';
        return (
          <div className="flex items-center gap-2">
            <Badge status={isActive ? 'success' : 'default'} />
            <span
              className={`text-xs font-medium ${
                isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {isActive ? t.statusActiveLabel : t.statusSuspendedLabel}
            </span>
          </div>
        );
      },
    },
    {
      title: t.colUserAction,
      key: 'action',
      width: 140,
      align: 'right',
      render: (_, record) => {
        const isSelf = currentUser?.id === record.id;
        const isActive = record.status === 'ACTIVE';

        if (isSelf) {
          return (
            <Tooltip title={t.cannotModifySelf}>
              <span className="text-xs text-slate-400 italic">
                {language === 'vi' ? 'Không khả dụng' : 'Protected'}
              </span>
            </Tooltip>
          );
        }

        return (
          <Popconfirm
            title={t.toggleStatusConfirmTitle}
            description={t.toggleStatusConfirmDesc}
            onConfirm={() => handleToggleStatus(record.id)}
            okText={t.confirm}
            cancelText={t.cancel}
          >
            <Button
              size="small"
              type={isActive ? 'default' : 'primary'}
              danger={isActive}
              icon={isActive ? <LockOutlined /> : <UnlockOutlined />}
              className="text-xs font-medium"
            >
              {isActive ? t.lockAccountBtn : t.unlockAccountBtn}
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <ApiErrorState
          error={error}
          onRetry={fetchUsers}
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
            {t.userManagement}
          </Title>
          <Text className="text-slate-500 dark:text-slate-400 text-sm">
            {t.userManagementSubtitle}
          </Text>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchUsers}
            loading={loading}
            className="shrink-0"
            title={t.refreshData}
          >
            <span className="hidden sm:inline">{t.refreshData}</span>
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              form.setFieldsValue({ role: 'EMPLOYEE', department: 'Phòng Kỹ thuật & Công nghệ' });
              setDrawerOpen(true);
            }}
            className="flex-1 sm:flex-none justify-center font-medium"
          >
            {t.addNewUserBtn}
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-[#1c1c1e] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 w-full md:max-w-md">
          <Input
            placeholder={t.searchUserPlaceholder}
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full md:w-auto md:flex md:flex-wrap md:items-center">
          {/* Role Filter */}
          <Select
            value={roleFilter}
            onChange={setRoleFilter}
            className="w-full md:w-[160px]"
            options={[
              { value: 'ALL', label: `${t.roleFilterLabel}: ${t.all}` },
              { value: 'ADMINISTRATOR', label: t.roleAdmin },
              { value: 'ROOM_MANAGER', label: t.roleManager },
              { value: 'EMPLOYEE', label: t.roleEmployee },
            ]}
          />

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            className="w-full md:w-[140px]"
            options={[
              { value: 'ALL', label: `${t.colUserStatus}: ${t.all}` },
              { value: 'ACTIVE', label: t.statusActiveLabel },
              { value: 'SUSPENDED', label: t.statusSuspendedLabel },
            ]}
          />

          {/* Department Filter */}
          {uniqueDepartments.length > 0 && (
            <Select
              value={departmentFilter}
              onChange={setDepartmentFilter}
              className="w-full md:w-[190px]"
              options={[
                { value: 'ALL', label: `${t.deptFilterLabel}: ${t.all}` },
                ...uniqueDepartments.map((dept) => ({ value: dept, label: dept })),
              ]}
            />
          )}
        </div>
      </div>

      {/* Content: Mobile Cards (< 768px) vs Desktop Table (>= 768px) */}
      {isMobile ? (
        <div className="space-y-3">
          {users.length === 0 ? (
            <div className="bg-white dark:bg-[#1c1c1e] p-8 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
              <Empty
                description={
                  <span className="text-slate-500">
                    {language === 'vi' ? 'Không tìm thấy người dùng phù hợp' : 'No users found'}
                  </span>
                }
              />
            </div>
          ) : (
            users
              .slice((mobilePage - 1) * mobilePageSize, mobilePage * mobilePageSize)
              .map((record) => {
                const isSelf = currentUser?.id === record.id;
                const isActive = record.status === 'ACTIVE';

                return (
                  <div
                    key={record.id}
                    className={`p-4 rounded-xl border transition-colors ${
                      isDark ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-slate-200 shadow-2xs'
                    }`}
                  >
                    {/* Top row: Avatar + Name + Status */}
                    <div className="flex items-start justify-between gap-2.5 mb-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          size={44}
                          src={record.avatar}
                          icon={<UserOutlined />}
                          className="shrink-0 border border-slate-200 dark:border-slate-700"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Text strong className="text-sm truncate">
                              {record.name}
                            </Text>
                            {isSelf && (
                              <Tag color="blue" className="text-xs mr-0">
                                {language === 'vi' ? 'Bạn' : 'You'}
                              </Tag>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                            <MailOutlined className="text-[10px]" />
                            <span className="truncate">{record.email}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <Badge
                          status={isActive ? 'success' : 'default'}
                          text={
                            <span
                              className={`text-xs font-semibold ${
                                isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'
                              }`}
                            >
                              {isActive ? t.statusActiveLabel : t.statusSuspendedLabel}
                            </span>
                          }
                        />
                      </div>
                    </div>

                    {/* Department & Phone */}
                    <div
                      className={`p-2.5 rounded-lg border text-xs mb-3 space-y-1 ${
                        isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                        <span className="text-slate-400 flex items-center gap-1">
                          <ApartmentOutlined /> {language === 'vi' ? 'Phòng ban:' : 'Dept:'}
                        </span>
                        <span className="font-medium truncate max-w-[200px]">{record.department || '—'}</span>
                      </div>
                      {record.phone && (
                        <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 pt-1 border-t border-slate-200/50 dark:border-white/5">
                          <span className="text-slate-400 flex items-center gap-1">
                            <PhoneOutlined /> {language === 'vi' ? 'Điện thoại:' : 'Phone:'}
                          </span>
                          <span className="font-mono tabular-nums">{record.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Role Switcher */}
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                        {t.colUserRole}:
                      </label>
                      <Tooltip title={isSelf ? t.cannotModifySelf : undefined}>
                        <Select
                          value={record.role}
                          disabled={isSelf}
                          style={{ width: '100%' }}
                          onChange={(val) => handleRoleChange(record.id, val)}
                          options={[
                            { value: 'ADMINISTRATOR', label: t.roleAdmin },
                            { value: 'ROOM_MANAGER', label: t.roleManager },
                            { value: 'EMPLOYEE', label: t.roleEmployee },
                          ]}
                          className="text-xs"
                        />
                      </Tooltip>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-2 border-t border-slate-100 dark:border-white/10">
                      {isSelf ? (
                        <div className="text-xs text-slate-400 italic text-center py-1.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/5">
                          {t.cannotModifySelf}
                        </div>
                      ) : (
                        <Popconfirm
                          title={t.toggleStatusConfirmTitle}
                          description={t.toggleStatusConfirmDesc}
                          onConfirm={() => handleToggleStatus(record.id)}
                          okText={t.confirm}
                          cancelText={t.cancel}
                        >
                          <Button
                            block
                            type={isActive ? 'default' : 'primary'}
                            danger={isActive}
                            icon={isActive ? <LockOutlined /> : <UnlockOutlined />}
                            className="text-xs font-semibold h-9"
                          >
                            {isActive ? t.lockAccountBtn : t.unlockAccountBtn}
                          </Button>
                        </Popconfirm>
                      )}
                    </div>
                  </div>
                );
              })
          )}

          {/* Mobile Pagination */}
          {users.length > mobilePageSize && (
            <div className="flex justify-center pt-2 pb-4">
              <Pagination
                size="small"
                current={mobilePage}
                pageSize={mobilePageSize}
                total={users.length}
                onChange={setMobilePage}
                showSizeChanger={false}
              />
            </div>
          )}
        </div>
      ) : (
        /* Desktop Table */
        <div className="bg-white dark:bg-[#1c1c1e] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <Table<UserAccount>
            rowKey="id"
            columns={columns}
            dataSource={users}
            loading={loading}
            scroll={{ x: 800 }}
            pagination={{
              pageSize: 8,
              showSizeChanger: false,
              showTotal: (total) => `${total} ${language === 'vi' ? 'người dùng' : 'users'}`,
            }}
            locale={{
              emptyText: (
                <Empty
                  description={
                    <span className="text-slate-500">
                      {language === 'vi' ? 'Không tìm thấy người dùng phù hợp' : 'No users found'}
                    </span>
                  }
                />
              ),
            }}
          />
        </div>
      )}

      {/* Drawer Create User */}
      <Drawer
        title={t.addNewUserBtn}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={isMobile ? '100%' : 420}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateUser}>
          <Form.Item
            name="name"
            label={language === 'vi' ? 'Họ và tên' : 'Full Name'}
            rules={[{ required: true, message: language === 'vi' ? 'Vui lòng nhập họ tên' : 'Name is required' }]}
          >
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: language === 'vi' ? 'Vui lòng nhập email' : 'Email is required' },
              { type: 'email', message: language === 'vi' ? 'Email không hợp lệ' : 'Invalid email' },
            ]}
          >
            <Input placeholder="a.nguyen@company.com" />
          </Form.Item>

          <Form.Item
            name="role"
            label={t.colUserRole}
            rules={[{ required: true, message: language === 'vi' ? 'Vui lòng chọn vai trò' : 'Role is required' }]}
          >
            <Select
              options={[
                { value: 'EMPLOYEE', label: t.roleEmployee },
                { value: 'ROOM_MANAGER', label: t.roleManager },
                { value: 'ADMINISTRATOR', label: t.roleAdmin },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="department"
            label={language === 'vi' ? 'Phòng ban' : 'Department'}
            rules={[{ required: true, message: language === 'vi' ? 'Vui lòng nhập phòng ban' : 'Department is required' }]}
          >
            <Input placeholder="Phòng Kỹ thuật & Công nghệ" />
          </Form.Item>

          <Form.Item name="phone" label={language === 'vi' ? 'Số điện thoại' : 'Phone Number'}>
            <Input placeholder="0912 345 678" />
          </Form.Item>

          <Form.Item name="avatar" label={language === 'vi' ? 'Đường dẫn ảnh đại diện (URL)' : 'Avatar URL'}>
            <Input placeholder="https://..." />
          </Form.Item>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button onClick={() => setDrawerOpen(false)}>{t.cancel}</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {language === 'vi' ? 'Tạo tài khoản' : 'Create Account'}
            </Button>
          </div>
        </Form>
      </Drawer>
    </div>
  );
};
