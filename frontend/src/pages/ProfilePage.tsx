import React, { useState, useEffect, useMemo } from 'react';
import {
  Row,
  Col,
  Card,
  Form,
  Input,
  Button,
  Avatar,
  Tag,
  Typography,
  Space,
  App,
  Progress,
  Tooltip,
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  ApartmentOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  EditOutlined,
  SaveOutlined,
  CameraOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getBookings } from '../api/client';
import { Booking } from '../types';

const { Title, Text } = Typography;

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=160&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=160&auto=format&fit=crop&q=80',
];

export const ProfilePage: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const { isDark } = useTheme();
  const { t, language } = useLanguage();
  const { message } = App.useApp();

  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string>(user?.avatar || PRESET_AVATARS[0]);
  const [userBookings, setUserBookings] = useState<Booking[]>([]);

  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        name: user.name,
        email: user.email,
        department: user.department || '',
        phone: user.phone || '',
        avatar: user.avatar || '',
      });
      setSelectedAvatar(user.avatar || PRESET_AVATARS[0]);
    }
  }, [user, form]);

  useEffect(() => {
    const fetchUserStats = async () => {
      if (!user) return;
      try {
        const res = await getBookings({ userId: user.id });
        setUserBookings(res.items);
      } catch (err) {
        console.error(err);
      }
    };
    fetchUserStats();
  }, [user]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = userBookings.length;
    const checkedIn = userBookings.filter((b) => b.status === 'CHECKED_IN').length;
    const cancelled = userBookings.filter((b) => b.status === 'CANCELLED').length;
    const checkInRate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
    return { total, checkedIn, cancelled, checkInRate };
  }, [userBookings]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await new Promise((r) => setTimeout(r, 200));

      updateProfile({
        name: values.name.trim(),
        department: values.department?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
        avatar: selectedAvatar,
      });

      message.success(t.profileUpdatedSuccess);
    } catch (err: any) {
      if (err?.errorFields) {
        message.error(language === 'vi' ? 'Vui lòng kiểm tra lại các trường thông tin' : 'Please verify all required fields');
      } else {
        message.error(err?.message || 'Error updating profile');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <Title level={3} style={{ margin: 0, fontWeight: 700, color: isDark ? '#f8fafc' : '#141b54' }}>
          {t.myProfile}
        </Title>
        <Text type="secondary" style={{ fontSize: 13, color: isDark ? '#94a3b8' : undefined }}>
          {t.profileSubtitle}
        </Text>
      </div>

      <Row gutter={[20, 20]}>
        {/* Left Column: Avatar & Quick Summary Card */}
        <Col xs={24} md={9}>
          <div className="space-y-4">
            {/* Identity Card */}
            <div className={`p-6 rounded-2xl border text-center transition-all ${
              isDark ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-slate-200 shadow-2xs'
            }`}>
              <div className="relative inline-block mx-auto mb-4">
                <Avatar
                  size={100}
                  src={selectedAvatar}
                  icon={<UserOutlined />}
                  className="shadow-md border-2 border-white/20"
                  style={{ backgroundColor: '#1e40af' }}
                />
              </div>

              <div className="font-bold text-lg text-slate-800 dark:text-white mb-0.5">
                {user?.name}
              </div>
              <div className="text-xs text-slate-400 mb-3 font-mono">
                {user?.email}
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 border"
                style={{
                  backgroundColor: user?.role === 'ADMINISTRATOR' ? 'rgba(168, 85, 247, 0.12)' : user?.role === 'ROOM_MANAGER' ? 'rgba(6, 182, 212, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                  borderColor: user?.role === 'ADMINISTRATOR' ? 'rgba(168, 85, 247, 0.3)' : user?.role === 'ROOM_MANAGER' ? 'rgba(6, 182, 212, 0.3)' : 'rgba(59, 130, 246, 0.3)',
                  color: user?.role === 'ADMINISTRATOR' ? '#c084fc' : user?.role === 'ROOM_MANAGER' ? '#22d3ee' : '#60a5fa',
                }}
              >
                <SafetyCertificateOutlined />
                <span>{user?.role === 'ADMINISTRATOR' ? t.roleAdmin : user?.role === 'ROOM_MANAGER' ? t.roleManager : t.roleEmployee}</span>
              </div>

              {/* Preset Avatars Selection */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/10 text-left">
                <div className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider text-center">
                  {t.choosePresetAvatar}
                </div>
                <div className="flex justify-center items-center gap-2 flex-wrap">
                  {PRESET_AVATARS.map((url, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setSelectedAvatar(url)}
                      className={`relative rounded-full transition-transform hover:scale-110 p-0.5 ${
                        selectedAvatar === url ? 'ring-2 ring-[#0a84ff] ring-offset-2 ring-offset-transparent' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <Avatar size={36} src={url} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Personal Stats Card */}
            <div className={`p-5 rounded-2xl border transition-all ${
              isDark ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-slate-200 shadow-2xs'
            }`}>
              <div className="font-semibold text-sm text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                <CalendarOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
                <span>{t.personalBookingStats}</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                  <span className="text-slate-500 dark:text-zinc-400">{t.totalBookingsCount}</span>
                  <span className="font-bold text-sm text-slate-800 dark:text-white font-mono">{stats.total}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                  <span className="text-slate-500 dark:text-zinc-400">{t.tabCheckedIn}</span>
                  <span className="font-bold text-sm text-emerald-500 font-mono">{stats.checkedIn}</span>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>{t.checkInRateLabel}</span>
                    <span className="font-bold font-mono">{stats.checkInRate}%</span>
                  </div>
                  <Progress
                    percent={stats.checkInRate}
                    size="small"
                    strokeColor={{ '0%': '#1e40af', '100%': '#30d158' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Col>

        {/* Right Column: Profile Edit Form */}
        <Col xs={24} md={15}>
          <div className={`p-6 rounded-2xl border transition-all ${
            isDark ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-slate-200 shadow-2xs'
          }`}>
            <div className="font-bold text-base text-slate-800 dark:text-white mb-1 flex items-center gap-2">
              <EditOutlined className="text-[#1e40af] dark:text-[#0a84ff]" />
              <span>{language === 'vi' ? 'Thông tin cá nhân & Liên hệ' : 'Personal & Contact Information'}</span>
            </div>
            <div className="text-xs text-slate-400 mb-6">
              {language === 'vi' ? 'Cập nhật họ tên, phòng ban và số điện thoại công tác của bạn' : 'Update your full name, department, and contact phone number'}
            </div>

            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              onFinish={handleSave}
            >
              <Form.Item
                name="name"
                label={<span className="font-medium text-xs text-slate-600 dark:text-zinc-300">{t.displayNameLabel}</span>}
                rules={[{ required: true, message: language === 'vi' ? 'Vui lòng nhập họ và tên' : 'Please enter your name' }]}
              >
                <Input
                  size="large"
                  prefix={<UserOutlined className="text-slate-400 mr-1" />}
                  placeholder={language === 'vi' ? 'Nguyễn Văn An' : 'John Doe'}
                  style={{ borderRadius: 10 }}
                />
              </Form.Item>

              <Form.Item
                name="email"
                label={<span className="font-medium text-xs text-slate-600 dark:text-zinc-300">Email (SSO)</span>}
                extra={
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    {language === 'vi' ? 'Email doanh nghiệp được cố định theo tài khoản SSO' : 'Company email managed by Enterprise SSO'}
                  </span>
                }
              >
                <Input
                  size="large"
                  disabled
                  prefix={<MailOutlined className="text-slate-400 mr-1" />}
                  style={{ borderRadius: 10 }}
                />
              </Form.Item>

              <Form.Item
                name="department"
                label={<span className="font-medium text-xs text-slate-600 dark:text-zinc-300">{t.departmentLabel}</span>}
              >
                <Input
                  size="large"
                  prefix={<ApartmentOutlined className="text-slate-400 mr-1" />}
                  placeholder={language === 'vi' ? 'Phòng Kỹ thuật & Công nghệ' : 'Technology & Product Department'}
                  style={{ borderRadius: 10 }}
                />
              </Form.Item>

              <Form.Item
                name="phone"
                label={<span className="font-medium text-xs text-slate-600 dark:text-zinc-300">{t.phoneLabel}</span>}
              >
                <Input
                  size="large"
                  prefix={<PhoneOutlined className="text-slate-400 mr-1" />}
                  placeholder="0988 123 456"
                  style={{ borderRadius: 10 }}
                />
              </Form.Item>

              <div className="pt-4 border-t border-slate-100 dark:border-white/10 flex justify-end">
                <Button
                  type="primary"
                  size="large"
                  htmlType="submit"
                  loading={saving}
                  icon={<SaveOutlined />}
                  style={{
                    backgroundColor: isDark ? '#0a84ff' : '#1e40af',
                    borderColor: isDark ? '#0a84ff' : '#1e40af',
                    borderRadius: 10,
                    fontWeight: 600,
                    paddingLeft: 24,
                    paddingRight: 24,
                  }}
                >
                  {t.saveProfileBtn}
                </Button>
              </div>
            </Form>
          </div>
        </Col>
      </Row>
    </div>
  );
};
export default ProfilePage;
