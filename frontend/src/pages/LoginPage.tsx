import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, Button, Typography, Space, Divider, Tag, Tooltip, App } from 'antd';
import {
  SafetyCertificateOutlined,
  UserOutlined,
  SettingOutlined,
  TeamOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useAuth, isAuth0Mode } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { UserRole } from '../types';
import { BrightnessIcon, MoonIcon } from '../components/ThemeIcons';
import { LanguageToggle } from '../components/LanguageToggle';

const { Title, Text, Paragraph } = Typography;

export const LoginPage: React.FC = () => {
  const { loginWithAuth0, loginWithRedirect, isAuthenticated } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { t, language } = useLanguage();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  const auth0Mode = isAuth0Mode(
    import.meta.env.VITE_AUTH0_DOMAIN,
    import.meta.env.VITE_AUTH0_CLIENT_ID,
    import.meta.env.VITE_AUTH0_AUDIENCE
  );

  // If already logged in, redirect
  React.useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleAuth0Login = async (role: UserRole = 'ADMINISTRATOR') => {
    if (auth0Mode && loginWithRedirect) {
      setLoading(true);
      message.loading({ content: t.loginConnecting, key: 'login_msg' });
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      await loginWithRedirect({ appState: { returnTo: from } });
      return;
    }
    // Mock mode
    setLoading(true);
    message.loading({ content: t.loginConnecting, key: 'login_msg' });
    setTimeout(() => {
      loginWithAuth0(role);
      message.success({ content: t.loginSuccess, key: 'login_msg' });
      setLoading(false);
      navigate('/dashboard');
    }, 600);
  };

  return (
    <div className={`min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-200 ${
      isDark ? 'bg-[#000000]' : 'bg-[#f8fafc]'
    }`}>
      {/* Top right language and theme toggle */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5">
        <LanguageToggle />
        <Tooltip title={isDark ? t.lightMode : t.darkMode}>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={language === 'vi' ? 'Chuyển đổi giao diện Sáng / Tối' : 'Toggle Light / Dark mode'}
            className="w-9 h-9 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/10 flex items-center justify-center transition-all cursor-pointer text-slate-700 dark:text-zinc-100 hover:text-black dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/15 hover:border-slate-400 dark:hover:border-white/30 active:scale-95 shadow-2xs"
          >
            {isDark ? (
              <BrightnessIcon size={18} className="transition-transform duration-200 hover:rotate-45" />
            ) : (
              <MoonIcon size={17} className="transition-transform duration-200 hover:-rotate-12" />
            )}
          </button>
        </Tooltip>
      </div>

      {/* Decorative background grid and glow */}
      <div className={`absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-40 ${
        isDark ? 'bg-[#0a84ff]/10' : 'bg-blue-100'
      }`} />
      <div className={`absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-40 ${
        isDark ? 'bg-[#00c2e8]/10' : 'bg-sky-100'
      }`} />

      <Card
        className={`w-full max-w-md rounded-2xl relative z-10 border transition-colors ${
          isDark
            ? 'bg-[#1c1c1e] border-white/10 text-white'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
        styles={{ body: { padding: '36px 28px' } }}
      >
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <img
              src="/assets/aistudio/apple-touch-icon_64d93247.png"
              alt="BlueOC Tech Logo"
              className="w-16 h-16 object-contain drop-shadow-md hover:scale-105 transition-transform"
            />
          </div>
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <span className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-[#141b54]'}`}>
              BlueOC
            </span>
            <span className="text-2xl font-black tracking-tight text-[#00c2e8]">
              TECH
            </span>
            <Tag color="cyan" style={{ margin: 0, borderRadius: 6, fontWeight: 600, marginLeft: 4 }}>
              MRMS
            </Tag>
          </div>
          <Title level={4} style={{ marginTop: 2, marginBottom: 4, fontWeight: 700, color: isDark ? '#ffffff' : '#141b54' }}>
            {t.loginAppTitle}
          </Title>
          <Text type="secondary" style={{ fontSize: 13, color: isDark ? '#8e8e93' : undefined }}>
            {t.loginAppSubtitle}
          </Text>
        </div>

        <div className={`mb-5 p-3.5 rounded-xl border ${
          isDark
            ? 'bg-white/5 border-white/10 text-zinc-300'
            : 'bg-sky-50/70 border-sky-100 text-slate-700'
        }`}>
          <div className="font-semibold text-xs text-[#00c2e8] flex items-center gap-1.5 mb-1">
            <SafetyCertificateOutlined />
            <span>{t.ssoAuthBoxTitle}</span>
          </div>
          <p className="m-0 text-xs text-slate-400">
            {t.ssoAuthBoxDesc}
          </p>
        </div>

        {/* Primary Auth0 Login Button Solid Corporate Blue */}
        <Button
          type="primary"
          size="large"
          block
          icon={<SafetyCertificateOutlined />}
          loading={loading}
          onClick={() => handleAuth0Login('ADMINISTRATOR')}
          style={{
            height: 46,
            fontSize: 15,
            fontWeight: 600,
            borderRadius: 10,
            backgroundColor: isDark ? '#0a84ff' : '#1e40af',
            borderColor: isDark ? '#0a84ff' : '#1e40af',
            boxShadow: isDark ? '0 4px 14px rgba(10, 132, 255, 0.3)' : '0 4px 14px rgba(30, 64, 175, 0.25)',
          }}
        >
          {t.loginWithAuth0Btn}
        </Button>

        <Divider plain>
          <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
            {t.orSelectTestRole}
          </span>
        </Divider>

        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Button
            block
            icon={<SettingOutlined />}
            onClick={() => handleAuth0Login('ADMINISTRATOR')}
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8 }}
          >
            <span>{t.roleAdmin} (Admin)</span>
            <Tag color="purple">{t.roleAdminFullAccess}</Tag>
          </Button>

          <Button
            block
            icon={<TeamOutlined />}
            onClick={() => handleAuth0Login('ROOM_MANAGER')}
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8 }}
          >
            <span>{t.roleManager} (Manager)</span>
            <Tag color="cyan">{t.roleManagerRoomAdmin}</Tag>
          </Button>

          <Button
            block
            icon={<UserOutlined />}
            onClick={() => handleAuth0Login('EMPLOYEE')}
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8 }}
          >
            <span>{t.roleEmployee} (Employee)</span>
            <Tag color="blue">{t.roleEmployeeBookingCheckin}</Tag>
          </Button>
        </Space>

        <div className={`mt-6 pt-3 border-t text-center ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
          <div className="flex items-center justify-center gap-2 text-slate-400 text-[11px]">
            <span><CheckCircleOutlined className="text-emerald-500 mr-1" />{t.instantSyncFeature}</span>
            <span>·</span>
            <span><CheckCircleOutlined className="text-emerald-500 mr-1" />{t.checkIn15mFeature}</span>
            <span>·</span>
            <span><CheckCircleOutlined className="text-emerald-500 mr-1" />{t.blueocSecurityFeature}</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

