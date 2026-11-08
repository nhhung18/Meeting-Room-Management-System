import React, { useState, useEffect } from 'react';
import {
  Form,
  InputNumber,
  Switch,
  Button,
  Typography,
  Card,
  Row,
  Col,
  Divider,
  Space,
  App,
  Popconfirm,
  Alert,
  Spin,
} from 'antd';
import {
  SettingOutlined,
  SaveOutlined,
  ReloadOutlined,
  FieldTimeOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { BookingPolicyConfig } from '../types';
import { getBookingPolicies, updateBookingPolicies, resetBookingPolicies } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { ApiErrorState } from '../components/ApiErrorState';

const { Title, Text, Paragraph } = Typography;

export const PolicySettingsPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { isDark } = useTheme();
  const { t, language } = useLanguage();
  const { message } = App.useApp();

  const [form] = Form.useForm<BookingPolicyConfig>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ status: number; detail: string } | null>(null);
  const [policyData, setPolicyData] = useState<BookingPolicyConfig | null>(null);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getBookingPolicies();
      setPolicyData(data);
      form.setFieldsValue(data);
    } catch (err: any) {
      setError({
        status: err.status ?? 0,
        detail: err.detail || err.message || (language === 'vi' ? 'Lỗi khi tải cấu hình quy định' : 'Error loading policy settings'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleSave = async (values: BookingPolicyConfig) => {
    if (!currentUser) return;
    try {
      setSaving(true);
      const updated = await updateBookingPolicies(values, {
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
      });
      setPolicyData(updated);
      message.success(t.savePolicySuccess);
    } catch (err: any) {
      message.error(err.message || 'Error saving policy settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!currentUser) return;
    try {
      setSaving(true);
      const reset = await resetBookingPolicies({
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
      });
      setPolicyData(reset);
      form.setFieldsValue(reset);
      message.success(t.resetPolicySuccess);
    } catch (err: any) {
      message.error(err.message || 'Error resetting policy settings');
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <ApiErrorState
          error={error}
          onRetry={fetchPolicies}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <Title level={3} className="!mb-1 tracking-tight">
            {t.bookingPolicySettings}
          </Title>
          <Text className="text-slate-500 dark:text-slate-400 text-sm">
            {t.policySubtitle}
          </Text>
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap sm:flex-nowrap shrink-0">
          <Popconfirm
            title={t.resetPolicyConfirmTitle}
            description={t.resetPolicyConfirmDesc}
            onConfirm={handleReset}
            okText={t.confirm}
            cancelText={t.cancel}
          >
            <Button icon={<ReloadOutlined />} loading={saving} className="flex-1 sm:flex-none">
              {t.resetPolicyBtn}
            </Button>
          </Popconfirm>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => form.submit()}
            loading={saving}
            className="flex-1 sm:flex-none"
          >
            {t.savePolicyBtn}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <Spin size="large" />
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          className="space-y-6"
        >
          {/* Metadata Banner */}
          {policyData && (
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <InfoCircleOutlined className="text-blue-500 text-sm shrink-0" />
                <span className="leading-snug">
                  {t.lastUpdatedPolicyLabel}{' '}
                  <strong className="font-mono tabular-nums">
                    {dayjs(policyData.updated_at).format('YYYY-MM-DD HH:mm')}
                  </strong>{' '}
                  ({language === 'vi' ? 'bởi' : 'by'} {policyData.updated_by_name})
                </span>
              </div>
              <span className="font-medium text-blue-600 dark:text-blue-400 shrink-0">
                {language === 'vi' ? 'Đang hiệu lực toàn công ty' : 'Active Organization Policy'}
              </span>
            </div>
          )}

          {/* Section 1: Thời gian & Thời lượng */}
          <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <FieldTimeOutlined className="text-blue-600 text-lg" />
              <Title level={4} className="!mb-0 text-base">
                {t.sectionBookingTimeLimits}
              </Title>
            </div>

            <Row gutter={[24, 16]}>
              <Col xs={24} md={8}>
                <Form.Item
                  name="max_advance_days"
                  label={t.maxAdvanceDaysLabel}
                  help={t.maxAdvanceDaysHelp}
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <InputNumber min={1} max={90} className="w-full" addonAfter={language === 'vi' ? 'ngày' : 'days'} />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  name="max_duration_minutes"
                  label={t.maxDurationLabel}
                  help={t.maxDurationHelp}
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <InputNumber min={15} max={480} step={15} className="w-full" addonAfter={language === 'vi' ? 'phút' : 'mins'} />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  name="min_duration_minutes"
                  label={t.minDurationLabel}
                  help={t.minDurationHelp}
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <InputNumber min={15} max={60} step={15} className="w-full" addonAfter={language === 'vi' ? 'phút' : 'mins'} />
                </Form.Item>
              </Col>
            </Row>
          </div>

          {/* Section 2: No-Show Protection */}
          <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <SafetyCertificateOutlined className="text-emerald-600 text-lg" />
              <Title level={4} className="!mb-0 text-base">
                {t.sectionNoShowProtection}
              </Title>
            </div>

            <Row gutter={[24, 16]}>
              <Col xs={24} md={8}>
                <Form.Item
                  name="enable_auto_release_no_show"
                  label={t.enableAutoReleaseLabel}
                  valuePropName="checked"
                >
                  <Switch checkedChildren={t.confirm} unCheckedChildren={t.cancel} />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  name="auto_release_grace_minutes"
                  label={t.autoReleaseGraceLabel}
                  help={t.autoReleaseGraceHelp}
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <InputNumber min={5} max={60} step={5} className="w-full" addonAfter={language === 'vi' ? 'phút' : 'mins'} />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  name="buffer_minutes_between_meetings"
                  label={t.bufferMinutesLabel}
                  help={t.bufferMinutesHelp}
                >
                  <InputNumber min={0} max={60} step={5} className="w-full" addonAfter={language === 'vi' ? 'phút' : 'mins'} />
                </Form.Item>
              </Col>
            </Row>
          </div>

          {/* Section 3: Quy định hủy lịch */}
          <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <StopOutlined className="text-amber-600 text-lg" />
              <Title level={4} className="!mb-0 text-base">
                {t.sectionCancellationPolicy}
              </Title>
            </div>

            <Row gutter={[24, 16]}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="min_cancel_notice_minutes"
                  label={t.minCancelNoticeLabel}
                  help={t.minCancelNoticeHelp}
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <InputNumber min={0} max={180} step={15} className="w-full" addonAfter={language === 'vi' ? 'phút' : 'mins'} />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              onClick={() => form.submit()}
              loading={saving}
              className="px-6"
            >
              {t.savePolicyBtn}
            </Button>
          </div>
        </Form>
      )}
    </div>
  );
};
