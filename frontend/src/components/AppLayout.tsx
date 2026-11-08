import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Typography,
  Space,
  Tag,
  Breadcrumb,
  Button,
  Tooltip,
  Drawer,
  App,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  SettingOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
  MenuOutlined,
  PlusCircleOutlined,
  ToolOutlined,
  IdcardOutlined,
  TeamOutlined,
  FileTextOutlined,
  ControlOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { UserRole } from '../types';
import { resetMockDataToDefault } from '../api/client';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { BrightnessIcon, MoonIcon } from './ThemeIcons';
import { LanguageToggle } from './LanguageToggle';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { t, language, toggleLanguage } = useLanguage();
  const { modal } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useBreakpoint();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Active state for "Thêm" (More) and all its sub-features
  const isMoreActive =
    mobileDrawerOpen ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/profile');

  // Breadcrumb mapping
  const getBreadcrumbs = () => {
    const path = location.pathname;
    const items = [{ title: <Link to="/dashboard">{t.home}</Link> }];

    if (path === '/dashboard') {
      items.push({ title: <span>{t.dashboard}</span> });
    } else if (path === '/rooms') {
      items.push({ title: <span>{t.roomList}</span> });
    } else if (path.startsWith('/rooms/') && path.endsWith('/book')) {
      items.push({ title: <Link to="/rooms">{t.roomList}</Link> });
      items.push({ title: <span>{t.newBooking}</span> });
    } else if (path.startsWith('/rooms/')) {
      items.push({ title: <Link to="/rooms">{t.roomList}</Link> });
      items.push({ title: <span>{t.roomDetailsBreadcrumb}</span> });
    } else if (path === '/book') {
      items.push({ title: <span>{t.newBooking}</span> });
    } else if (path === '/my-bookings') {
      items.push({ title: <span>{t.myBookings}</span> });
    } else if (path === '/admin/users') {
      items.push({ title: <span>{t.adminSection}</span> });
      items.push({ title: <span>{t.userManagement}</span> });
    } else if (path === '/admin/rooms') {
      items.push({ title: <span>{t.adminSection}</span> });
      items.push({ title: <span>{t.roomManagement}</span> });
    } else if (path === '/admin/equipment') {
      items.push({ title: <span>{t.adminSection}</span> });
      items.push({ title: <span>{t.equipmentManagement}</span> });
    } else if (path === '/admin/reports') {
      items.push({ title: <span>{t.adminSection}</span> });
      items.push({ title: <span>{t.reports}</span> });
    } else if (path === '/admin/audit-logs') {
      items.push({ title: <span>{t.adminSection}</span> });
      items.push({ title: <span>{t.auditLogs}</span> });
    } else if (path === '/admin/settings') {
      items.push({ title: <span>{t.adminSection}</span> });
      items.push({ title: <span>{t.bookingPolicySettings}</span> });
    }
    return items;
  };

  // Dynamic menu based on user role
  const menuItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined style={{ fontSize: 16 }} />,
      label: t.dashboard,
    },
    {
      key: '/rooms',
      icon: <AppstoreOutlined style={{ fontSize: 16 }} />,
      label: t.roomList,
    },
    {
      key: '/my-bookings',
      icon: <CalendarOutlined style={{ fontSize: 16 }} />,
      label: t.myBookings,
    },
  ];

  if (user?.role === 'ROOM_MANAGER' || user?.role === 'ADMINISTRATOR') {
    menuItems.push({
      key: '/admin/rooms',
      icon: <SettingOutlined style={{ fontSize: 16 }} />,
      label: t.roomManagement,
    });
    menuItems.push({
      key: '/admin/equipment',
      icon: <ToolOutlined style={{ fontSize: 16 }} />,
      label: t.equipmentManagement,
    });
  }

  if (user?.role === 'ADMINISTRATOR') {
    menuItems.push({
      key: '/admin/users',
      icon: <TeamOutlined style={{ fontSize: 16 }} />,
      label: t.userManagement,
    });
    menuItems.push({
      key: '/admin/reports',
      icon: <BarChartOutlined style={{ fontSize: 16 }} />,
      label: t.reports,
    });
    menuItems.push({
      key: '/admin/audit-logs',
      icon: <FileTextOutlined style={{ fontSize: 16 }} />,
      label: t.auditLogs,
    });
    menuItems.push({
      key: '/admin/settings',
      icon: <ControlOutlined style={{ fontSize: 16 }} />,
      label: t.bookingPolicySettings,
    });
  }

  // Selected menu key
  const activeKey = menuItems.find((item) => {
    if (!item?.key) return false;
    const keyStr = String(item.key);
    if (keyStr === '/rooms' && (location.pathname.startsWith('/rooms/') || location.pathname === '/book')) {
      return true;
    }
    return location.pathname === keyStr;
  })?.key || (location.pathname.startsWith('/profile') ? '/profile' : '/dashboard');

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    navigate(e.key);
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
  };

  const handleResetData = () => {
    modal.confirm({
      centered: true,
      wrapClassName: 'ant-modal-centered',
      title: t.restoreDemoConfirmTitle,
      content: t.restoreDemoConfirmContent,
      okText: t.confirm,
      cancelText: t.cancel,
      onOk: () => {
        resetMockDataToDefault();
        window.location.reload();
      },
    });
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'user-info',
      disabled: true,
      label: (
        <div className="py-1.5 px-1 min-w-[210px]">
          {/* Email có div nhãn Email: rõ ràng, không hiển thị Tên */}
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">{t.emailLabel}</span>
            <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{user?.email}</span>
          </div>

          {/* Dòng thông tin phòng ban */}
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1.5">
            <span className="text-slate-400">{t.roomDeptLabel}</span>
            <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{user?.department || (language === 'vi' ? 'Khối Kỹ thuật & Vận hành' : 'Tech & Operations')}</span>
          </div>

          {/* Vẫn để tag vai trò riêng biệt, không đi kèm với tên */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">{t.roleLabel}</span>
            <Tag
              color={user?.role === 'ADMINISTRATOR' ? 'purple' : user?.role === 'ROOM_MANAGER' ? 'cyan' : 'blue'}
              style={{ margin: 0, borderRadius: 6, fontSize: 11 }}
            >
              {user?.role === 'ADMINISTRATOR' ? t.roleAdmin : user?.role === 'ROOM_MANAGER' ? t.roleManager : t.roleEmployee}
            </Tag>
          </div>
        </div>
      ),
    },
    { type: 'divider' },
    {
      key: 'profile',
      icon: <IdcardOutlined />,
      label: t.myProfile,
      onClick: () => navigate('/profile'),
    },
    {
      key: 'reset-data',
      icon: <ReloadOutlined />,
      label: t.restoreDemo,
      onClick: handleResetData,
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      danger: true,
      label: t.logout,
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  const getRoleBadge = (role?: UserRole) => {
    switch (role) {
      case 'ADMINISTRATOR':
        return <Tag color="purple">{t.roleAdmin}</Tag>;
      case 'ROOM_MANAGER':
        return <Tag color="cyan">{t.roleManager}</Tag>;
      default:
        return <Tag color="blue">{t.roleEmployee}</Tag>;
    }
  };

  return (
    <Layout className={`h-screen overflow-hidden transition-colors duration-200 ${isDark ? 'bg-[#000000] text-slate-100' : 'bg-[#f8fafc] text-slate-800'}`}>
      {/* Fixed Sider Sidebar for Tablet & Desktop (>= 768px) */}
      {!isMobile && (
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          breakpoint="lg"
          onBreakpoint={(broken) => {
            if (broken) setCollapsed(true);
          }}
          width={250}
          theme={isDark ? 'dark' : 'light'}
          className={`border-r z-20 shrink-0 transition-all duration-200 ${
            isDark
              ? 'border-white/10 bg-[#121214]/85 backdrop-blur-xl'
              : 'border-slate-200 bg-white'
          }`}
          style={{
            overflowY: 'auto',
            height: '100vh',
            position: 'sticky',
            top: 0,
            left: 0,
            backgroundColor: isDark ? 'rgba(18, 18, 20, 0.85)' : '#ffffff',
            backdropFilter: isDark ? 'blur(20px)' : undefined,
          }}
        >
          {/* Brand / Logo - Clickable to return to dashboard */}
          <div
            onClick={() => navigate('/dashboard')}
            className={`h-16 flex items-center px-4 border-b transition-all overflow-hidden cursor-pointer select-none hover:opacity-90 active:scale-[0.99] ${
              isDark ? 'border-white/10 bg-transparent' : 'border-slate-100 bg-white'
            }`}
            title={t.dashboard}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                navigate('/dashboard');
              }
            }}
          >
            {collapsed ? (
              <div className="w-full flex justify-center">
                <img
                  src="/assets/aistudio/apple-touch-icon_64d93247.png"
                  alt="BlueOC"
                  className="w-8 h-8 object-contain shrink-0"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <img
                  src="/assets/aistudio/apple-touch-icon_64d93247.png"
                  alt="BlueOC"
                  className="w-8 h-8 object-contain shrink-0"
                />
                <div className="overflow-hidden whitespace-nowrap">
                  <div className="font-extrabold text-base leading-tight tracking-tight flex items-center gap-1">
                    <span className={isDark ? 'text-white' : 'text-[#141b54]'}>BlueOC</span>
                    <span className="text-[#00c2e8]">TECH</span>
                  </div>
                  <div className={`text-[10px] font-medium tracking-wide uppercase ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    Meeting Room System
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Menu */}
          <div className="py-2">
            <Menu
              mode="inline"
              theme={isDark ? 'dark' : 'light'}
              selectedKeys={[String(activeKey)]}
              items={menuItems}
              onClick={handleMenuClick}
              style={{
                borderRight: 0,
                backgroundColor: 'transparent',
              }}
            />
          </div>
        </Sider>
      )}

      {/* Main Container */}
      <Layout className={`flex flex-col h-screen overflow-hidden transition-colors duration-200 ${isDark ? 'bg-[#000000]' : 'bg-[#f8fafc]'}`}>
        {/* Fixed Header - Apple HIG Translucent Vibrancy */}
        <Header
          className="px-4 sm:px-6 h-14 sm:h-16 border-b flex items-center justify-between sticky top-0 z-30 shrink-0 transition-colors duration-200"
          style={{
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : '#ffffff',
            borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e2e8f0',
            color: isDark ? '#ffffff' : '#141b54',
            paddingLeft: isMobile ? 14 : 20,
            paddingRight: isMobile ? 14 : 24,
            lineHeight: isMobile ? '56px' : '64px',
            backdropFilter: isDark ? 'blur(20px)' : undefined,
          }}
        >
          {/* Left: Desktop Sider Collapse / Mobile Logo */}
          <div className="flex items-center gap-3">
            {!isMobile && (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{ fontSize: 16, width: 36, height: 36, color: isDark ? '#f8fafc' : '#141b54' }}
                aria-label="Thu gọn/mở rộng menu"
              />
            )}

            {/* Mobile App Brand on Header - Clickable to return to dashboard */}
            {isMobile ? (
              <div
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 cursor-pointer select-none hover:opacity-85 active:scale-95 transition-all"
                title={t.dashboard}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    navigate('/dashboard');
                  }
                }}
              >
                <img
                  src="/assets/aistudio/apple-touch-icon_64d93247.png"
                  alt="BlueOC"
                  className="w-7 h-7 object-contain shrink-0"
                />
                <div className="font-extrabold text-sm leading-none flex items-center gap-0.5">
                  <span className={isDark ? 'text-white' : 'text-[#141b54]'}>BlueOC</span>
                  <span className="text-[#00c2e8]">TECH</span>
                </div>
              </div>
            ) : (
              <div className="hidden sm:block">
                <Breadcrumb items={getBreadcrumbs()} />
              </div>
            )}
          </div>

          {/* Right: Language Toggle + Theme Toggle (+ User Profile on Desktop only) */}
          <Space size={isMobile ? 'small' : 'middle'} className="items-center">
            {/* Language Toggle Button (VI / EN) */}
            <LanguageToggle />

            {/* Theme Toggle Button (Light / Dark) with Apple HIG border */}
            <Tooltip title={isDark ? t.lightMode : t.darkMode}>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Chuyển đổi giao diện Sáng / Tối"
                className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1c1c1e] transition-all cursor-pointer text-slate-700 dark:text-zinc-200 hover:text-black dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#2c2c2e] hover:border-slate-400 dark:hover:border-white/30 active:scale-95 shadow-2xs"
              >
                {isDark ? (
                  <BrightnessIcon size={18} className="transition-transform duration-200 hover:rotate-45" />
                ) : (
                  <MoonIcon size={17} className="transition-transform duration-200 hover:-rotate-12" />
                )}
              </button>
            </Tooltip>

            {/* User Profile Avatar - Desktop only */}
            {!isMobile && (
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow trigger={['click']}>
                <div className={`flex items-center gap-2 cursor-pointer py-1 px-2 rounded-xl border transition-colors ${
                  isDark
                    ? 'border-white/20 hover:bg-white/15 bg-white/10'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}>
                  <Avatar
                    src={user?.avatar}
                    icon={<UserOutlined />}
                    size={36}
                    style={{ backgroundColor: isDark ? '#0a84ff' : '#1e40af' }}
                  />
                  <span className={`hidden md:inline-block text-xs font-semibold pr-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {user?.name}
                  </span>
                </div>
              </Dropdown>
            )}
          </Space>
        </Header>

        {/* Content Area with smooth independent scrolling */}
        <Content
          className={`flex-1 overflow-y-auto transition-colors duration-200 ${isDark ? 'bg-[#000000]' : 'bg-[#f8fafc]'}`}
          style={{
            margin: 0,
            padding: isMobile ? '14px 12px 76px 12px' : '20px 24px',
          }}
        >
          <div className="max-w-[1400px] mx-auto w-full">
            <Outlet />
          </div>
        </Content>

        {/* Mobile Fixed Bottom Navigation Bar (< 768px) */}
        {isMobile && (
          <div className={`fixed bottom-0 left-0 right-0 h-15 border-t flex items-center justify-around z-30 px-2 transition-colors duration-200 ${
            isDark
              ? 'bg-[#1c1c1e] border-white/10 shadow-[0_-4px_16px_rgba(0,0,0,0.8)]'
              : 'bg-white border-slate-200 shadow-md'
          }`}>
            {/* Dashboard */}
            <button
              onClick={() => navigate('/dashboard')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                location.pathname === '/dashboard' ? 'text-[#1e40af] dark:text-[#38bdf8] font-bold' : 'text-slate-400 font-medium'
              }`}
            >
              <DashboardOutlined style={{ fontSize: 18 }} />
              <span className="text-[10px] mt-0.5">{t.mobileNavDashboard}</span>
            </button>

            {/* Phòng họp */}
            <button
              onClick={() => navigate('/rooms')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                location.pathname.startsWith('/rooms') ? 'text-[#1e40af] dark:text-[#38bdf8] font-bold' : 'text-slate-400 font-medium'
              }`}
            >
              <AppstoreOutlined style={{ fontSize: 18 }} />
              <span className="text-[10px] mt-0.5">{t.mobileNavRooms}</span>
            </button>

            {/* Đặt nhanh (+) Solid Corporate Navy in Light, Gentle Bright Blue (#0a84ff) in Dark */}
            <button
              onClick={() => navigate('/book')}
              className="flex flex-col items-center justify-center -mt-5"
            >
              <div className="w-11 h-11 rounded-full bg-[#1e40af] hover:bg-[#1e3a8a] dark:bg-[#0a84ff] dark:hover:bg-[#0071e3] text-white flex items-center justify-center shadow-md shadow-blue-950/30 dark:shadow-[#0a84ff]/30 active:scale-95 transition-all">
                <PlusCircleOutlined style={{ fontSize: 22 }} />
              </div>
              <span className="text-[10px] mt-0.5 text-[#1e40af] dark:text-[#38bdf8] font-semibold">{t.mobileNavBook}</span>
            </button>

            {/* My Bookings */}
            <button
              onClick={() => navigate('/my-bookings')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                location.pathname === '/my-bookings' ? 'text-[#1e40af] dark:text-[#38bdf8] font-bold' : 'text-slate-400 font-medium'
              }`}
            >
              <CalendarOutlined style={{ fontSize: 18 }} />
              <span className="text-[10px] mt-0.5">{t.mobileNavSchedule}</span>
            </button>

            {/* Menu More */}
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                isMoreActive ? 'text-[#1e40af] dark:text-[#38bdf8] font-bold' : 'text-slate-400 font-medium'
              }`}
            >
              <MenuOutlined style={{ fontSize: 18 }} />
              <span className="text-[10px] mt-0.5">{t.mobileNavMore}</span>
            </button>
          </div>
        )}
      </Layout>

      {/* Mobile Drawer Navigation Menu */}
      <Drawer
        title={
          <div
            onClick={() => {
              setMobileDrawerOpen(false);
              navigate('/dashboard');
            }}
            className="flex items-center gap-2.5 cursor-pointer select-none hover:opacity-85 active:scale-[0.98] transition-all"
            title={t.dashboard}
            role="button"
            tabIndex={0}
          >
            <img
              src="/assets/aistudio/apple-touch-icon_64d93247.png"
              alt="BlueOC"
              className="w-7 h-7 object-contain shrink-0"
            />
            <div>
              <div className="font-extrabold text-sm flex items-center gap-0.5">
                <span className={isDark ? 'text-white' : 'text-[#141b54]'}>BlueOC</span>
                <span className="text-[#00c2e8]">TECH</span>
              </div>
              <div className="text-[11px] text-slate-400">Meeting Room System</div>
            </div>
          </div>
        }
        placement="left"
        size={290}
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen}
        styles={{
          body: {
            padding: '12px 8px',
            backgroundColor: isDark ? '#121214' : '#ffffff',
          },
          header: {
            backgroundColor: isDark ? '#18181b' : '#ffffff',
            borderColor: isDark ? '#27272a' : '#e2e8f0',
          },
        }}
      >
        {/* User preview inside drawer */}
        <div
          onClick={() => {
            setMobileDrawerOpen(false);
            navigate('/profile');
          }}
          className={`p-3 mb-2 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
            location.pathname === '/profile'
              ? isDark
                ? 'bg-[#18181b] border-[#0a84ff]'
                : 'bg-blue-50/80 border-[#1e40af]'
              : isDark
                ? 'bg-[#18181b] border-[#27272a] hover:border-[#0a84ff]'
                : 'bg-blue-50/60 border-blue-100 hover:border-[#1e40af]'
          }`}
        >
          <Avatar
            src={user?.avatar}
            icon={<UserOutlined />}
            size={40}
            style={{ backgroundColor: isDark ? '#0a84ff' : '#1e40af' }}
          />
          <div className="overflow-hidden min-w-0 flex-1">
            <div className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{user?.name}</div>
            <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
            <div className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {t.roomDeptLabel} {user?.department || (language === 'vi' ? 'Khối Kỹ thuật & Vận hành' : 'Tech & Operations')}
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <div>{getRoleBadge(user?.role)}</div>
              <span className="text-[10px] text-[#1e40af] dark:text-[#38bdf8] font-medium">{t.myProfile} &rarr;</span>
            </div>
          </div>
        </div>

        {/* Menu items */}
        <Menu
          mode="inline"
          theme={isDark ? 'dark' : 'light'}
          selectedKeys={[String(activeKey)]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0, backgroundColor: 'transparent' }}
        />

        {/* Quick action buttons in drawer: removed theme & language switchers as requested */}
        <div className={`mt-6 pt-4 border-t space-y-2 px-2 ${isDark ? 'border-blue-900/40' : 'border-slate-100'}`}>
          <Button
            block
            icon={<IdcardOutlined />}
            onClick={() => {
              setMobileDrawerOpen(false);
              navigate('/profile');
            }}
          >
            {t.myProfile}
          </Button>

          <Button
            block
            icon={<ReloadOutlined />}
            onClick={() => {
              setMobileDrawerOpen(false);
              handleResetData();
            }}
          >
            {t.restoreDemo}
          </Button>

          <Button
            block
            danger
            icon={<LogoutOutlined />}
            onClick={() => {
              setMobileDrawerOpen(false);
              logout();
              navigate('/login');
            }}
          >
            {t.logout}
          </Button>
        </div>
      </Drawer>
    </Layout>
  );
};
