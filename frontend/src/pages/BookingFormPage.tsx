import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Form,
  Select,
  DatePicker,
  InputNumber,
  Input,
  Button,
  Typography,
  Row,
  Col,
  Alert,
  Descriptions,
  Divider,
  Spin,
  App,
} from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  UserOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { Room, BookingPolicyConfig } from '../types';
import { getRooms, createBooking, getBookingById, updateBooking, getBookingPolicies } from '../api/client';
import { ApiErrorState } from '../components/ApiErrorState';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const { Title, Text } = Typography;

export const TIME_SLOTS_30MIN = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00',
];

interface BookingFormValues {
  room_id: number;
  date: Dayjs;
  start_time: string;
  end_time: string;
  num_attendees: number;
  purpose: string;
  attendees?: Array<{ name: string; attendee_email: string }>;
}

export const BookingFormPage: React.FC = () => {
  const { id, bookingId } = useParams<{ id?: string; bookingId?: string }>();
  const isEditMode = Boolean(bookingId);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { t, language } = useLanguage();
  const { message } = App.useApp();

  const [form] = Form.useForm<BookingFormValues>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ status: number; detail: string } | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [capacityWarning, setCapacityWarning] = useState<string | null>(null);
  const [policies, setPolicies] = useState<BookingPolicyConfig | null>(null);

  // Watch fields for live summary
  const watchedValues = Form.useWatch([], form);

  const fetchFormData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load organization policies
      const policyData = await getBookingPolicies();
      setPolicies(policyData);

      if (isEditMode) {
        // Fetch room catalog and current booking
        const [roomsRes, existing] = await Promise.all([
          getRooms(),
          getBookingById(Number(bookingId)),
        ]);
        setRooms(roomsRes.items);

        // Constraint check: only CONFIRMED bookings can be edited
        if (existing.status !== 'CONFIRMED') {
          setError({
            status: 409,
            detail: t.errCannotEditStatus,
          });
          return;
        }

        const roomMatch = roomsRes.items.find((r) => r.id === existing.room_id) || null;
        setSelectedRoom(roomMatch);

        const startD = dayjs(existing.start_at);
        const endD = dayjs(existing.end_at);

        form.setFieldsValue({
          room_id: existing.room_id,
          date: startD,
          start_time: startD.format('HH:mm'),
          end_time: endD.format('HH:mm'),
          num_attendees: existing.num_attendees,
          purpose: existing.purpose || '',
          attendees: existing.attendees?.map((att) => ({
            name: att.name,
            attendee_email: att.attendee_email,
          })) || [],
        });
      } else {
        // Create mode: fetch AVAILABLE rooms
        const res = await getRooms({ status: 'AVAILABLE' });
        setRooms(res.items);

        // Pre-select room if ID given in URL
        if (id) {
          const found = res.items.find((r) => r.id === Number(id));
          if (found) {
            setSelectedRoom(found);
            form.setFieldsValue({ room_id: found.id });
          }
        } else if (res.items.length > 0) {
          const roomParam = searchParams.get('room');
          const found = res.items.find((r) => r.id === Number(roomParam)) || res.items[0];
          if (found) {
            setSelectedRoom(found);
            form.setFieldsValue({ room_id: found.id });
          }
        }

        // Pre-fill date and time from searchParams if present
        const dateParam = searchParams.get('date');
        const timeParam = searchParams.get('time');

        if (dateParam) {
          form.setFieldsValue({ date: dayjs(dateParam) });
        } else {
          form.setFieldsValue({ date: dayjs() });
        }

        if (timeParam && TIME_SLOTS_30MIN.includes(timeParam)) {
          const idx = TIME_SLOTS_30MIN.indexOf(timeParam);
          const nextSlot = TIME_SLOTS_30MIN[Math.min(idx + 2, TIME_SLOTS_30MIN.length - 1)];
          form.setFieldsValue({
            start_time: timeParam,
            end_time: nextSlot,
          });
        } else {
          form.setFieldsValue({
            start_time: '17:00',
            end_time: '17:30',
          });
        }

        // Default attendees count
        form.setFieldsValue({
          num_attendees: 4,
          attendees: [
            {
              name: user?.name || 'Nguyễn Văn An',
              attendee_email: user?.email || 'an.nguyen@company.com',
            },
          ],
        });
      }
    } catch (err: any) {
      setError({
        status: err.status ?? 0,
        detail: err.detail || err.message || (isEditMode ? 'Không thể tải thông tin đặt phòng' : 'Không thể tải danh sách phòng họp'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFormData();
  }, [id, bookingId, isEditMode, searchParams, form, user]);

  const handleRoomChange = (roomId: number) => {
    const r = rooms.find((item) => item.id === roomId);
    setSelectedRoom(r || null);
    if (r) {
      const currentAttendees = form.getFieldValue('num_attendees');
      if (currentAttendees && currentAttendees > r.capacity) {
        setCapacityWarning(
          language === 'vi'
            ? `Số lượng người tham dự (${currentAttendees}) vượt quá sức chứa (${r.capacity} người) của phòng này.`
            : `Attendee count (${currentAttendees}) exceeds capacity (${r.capacity} attendees) of this room.`
        );
      } else {
        setCapacityWarning(null);
      }
    }
  };

  const checkCapacity = (attendeesCount: number) => {
    if (selectedRoom && attendeesCount > selectedRoom.capacity) {
      setCapacityWarning(
        language === 'vi'
          ? `Số lượng người tham dự (${attendeesCount}) vượt quá sức chứa (${selectedRoom.capacity} người) của phòng ${selectedRoom.name}.`
          : `Attendee count (${attendeesCount}) exceeds capacity (${selectedRoom.capacity} attendees) of room ${selectedRoom.name}.`
      );
    } else {
      setCapacityWarning(null);
    }
  };

  const disabledDate = (current: Dayjs) => {
    if (!current) return false;
    if (current < dayjs().startOf('day')) return true;
    if (policies?.max_advance_days && current > dayjs().add(policies.max_advance_days, 'day').endOf('day')) {
      return true;
    }
    return false;
  };

  const onFinish = async (values: BookingFormValues) => {
    try {
      setSubmitting(true);

      const dateStr = values.date.format('YYYY-MM-DD');
      const startStr = typeof values.start_time === 'string' ? values.start_time : '17:00';
      const endStr = typeof values.end_time === 'string' ? values.end_time : '17:30';

      const startAt = `${dateStr}T${startStr}:00Z`;
      const endAt = `${dateStr}T${endStr}:00Z`;

      const startDayjs = dayjs(`${dateStr}T${startStr}:00`);
      const endDayjs = dayjs(`${dateStr}T${endStr}:00`);

      if (endDayjs.isBefore(startDayjs) || endDayjs.isSame(startDayjs)) {
        form.setFields([
          {
            name: 'end_time',
            errors: [t.errEndTimeAfterStart],
          },
        ]);
        setSubmitting(false);
        return;
      }

      // Check policy max meeting duration
      const durationMinutes = endDayjs.diff(startDayjs, 'minute');
      if (policies?.max_duration_minutes && durationMinutes > policies.max_duration_minutes) {
        form.setFields([
          {
            name: 'end_time',
            errors: [
              t.policyMaxDurationExceeded.replace('{max}', String(policies.max_duration_minutes)),
            ],
          },
        ]);
        setSubmitting(false);
        return;
      }

      if (isEditMode) {
        // Global constraint: do NOT send purpose in updateBooking schema
        await updateBooking(Number(bookingId), {
          room_id: values.room_id,
          start_at: startAt,
          end_at: endAt,
          num_attendees: values.num_attendees,
          attendees: (values.attendees || []).map((att) => ({
            name: att.name,
            attendee_email: att.attendee_email,
          })),
        });
        message.success(t.editBookingSuccess);
        navigate('/my-bookings');
      } else {
        await createBooking({
          room_id: values.room_id,
          start_at: startAt,
          end_at: endAt,
          num_attendees: values.num_attendees,
          attendees: (values.attendees || []).map((att) => ({
            name: att.name,
            attendee_email: att.attendee_email,
          })),
        });
        message.success(t.bookingSuccess);
        navigate('/my-bookings');
      }
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('409') || err.message?.includes('trùng lịch') || err.message?.includes('đã đặt')) {
        message.error(err.message || t.errBookingConflict);
      } else {
        message.error(err.message || t.errBookingFailed);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={`py-20 text-center rounded-2xl border ${isDark ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-slate-200'}`}>
        <Spin size="large" description={t.loadingRooms} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/my-bookings')}
            className={`p-0 mb-2 font-medium ${isDark ? 'text-zinc-400 hover:text-[#0a84ff]' : 'text-slate-500 hover:text-[#1e40af]'}`}
          >
            {t.myBookings}
          </Button>
        </div>
        <ApiErrorState error={error} onRetry={fetchFormData} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 overflow-x-hidden">
      {/* Top Navigation Back */}
      <div>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => {
            if (isEditMode) navigate('/my-bookings');
            else if (id) navigate(`/rooms/${id}`);
            else navigate('/rooms');
          }}
          className={`p-0 mb-2 font-medium ${isDark ? 'text-zinc-400 hover:text-[#0a84ff]' : 'text-slate-500 hover:text-[#1e40af]'}`}
        >
          {isEditMode ? t.myBookings : id ? t.backToRoomDetails : t.backToRoomList}
        </Button>

        <Title level={3} style={{ margin: 0, fontWeight: 700, color: isDark ? '#ffffff' : '#141b54' }}>
          {isEditMode ? t.editBookingTitle : t.bookingFormTitle}
        </Title>
        <Text type="secondary" style={{ fontSize: 13, color: isDark ? '#8e8e93' : undefined }}>
          {isEditMode ? t.editBookingSubtitle : t.bookingFormSubtitle}
        </Text>
      </div>

      {/* Main Booking Form Card */}
      <div className={`p-5 sm:p-7 rounded-2xl border transition-colors ${
        isDark ? 'bg-[#1c1c1e] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
          onFinish={onFinish}
          initialValues={{
            num_attendees: 4,
          }}
        >
          {policies && (
            <div className="mb-4 p-3 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
              <InfoCircleOutlined className="text-blue-600 dark:text-blue-400 text-sm shrink-0" />
              <span>
                <strong>{t.policyNoticeBanner}</strong> {language === 'vi' ? 'Đặt trước tối đa' : 'Max advance'} {policies.max_advance_days} {language === 'vi' ? 'ngày' : 'days'} · {language === 'vi' ? 'Thời lượng tối đa' : 'Max length'} {policies.max_duration_minutes} {language === 'vi' ? 'phút' : 'mins'}
                {policies.enable_auto_release_no_show && (
                  <span> · {language === 'vi' ? `Tự hủy nếu không check-in sau ${policies.auto_release_grace_minutes} phút` : `Auto-cancel if no check-in after ${policies.auto_release_grace_minutes}m`}</span>
                )}
              </span>
            </div>
          )}

          {capacityWarning && (
            <Alert
              type="warning"
              showIcon
              message={capacityWarning}
              className="mb-5 rounded-lg border-amber-300 dark:border-amber-700/60"
            />
          )}

          <Row gutter={[20, 0]}>
            {/* Chọn phòng họp */}
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t.fieldRoom}</span>}
                name="room_id"
                rules={[{ required: true, message: t.errRequiredRoom }]}
              >
                <Select
                  size="large"
                  placeholder={t.fieldRoomPlaceholder}
                  onChange={handleRoomChange}
                  options={rooms.map((r) => ({
                    value: r.id,
                    label: (
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{r.name}</span>
                        <span className="text-xs text-slate-400 font-mono">
                          {r.capacity} {t.peopleUnit} - {r.floor || t.defaultRoomFloor}
                        </span>
                      </div>
                    ),
                  }))}
                />
              </Form.Item>
            </Col>

            {/* Ngày họp */}
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t.fieldDate}</span>}
                name="date"
                rules={[{ required: true, message: t.errRequiredDate }]}
              >
                <DatePicker
                  size="large"
                  style={{ width: '100%' }}
                  format="DD/MM/YYYY"
                  disabledDate={disabledDate}
                  placeholder={t.fieldDatePlaceholder}
                  prefix={<CalendarOutlined className="text-slate-400" />}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Khung giờ: Giờ bắt đầu & Giờ kết thúc */}
          <Row gutter={[20, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t.fieldStartTime}</span>}
                name="start_time"
                rules={[{ required: true, message: t.errRequiredStartTime }]}
              >
                <Select
                  size="large"
                  showSearch
                  popupMatchSelectWidth={false}
                  styles={{ popup: { root: { minWidth: 200 } } }}
                  placeholder={t.fieldStartTimePlaceholder}
                  suffixIcon={<ClockCircleOutlined className="text-slate-400" />}
                  options={TIME_SLOTS_30MIN.map((slot) => ({
                    value: slot,
                    label: <span className="font-mono font-medium">{slot}</span>,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t.fieldEndTime}</span>}
                name="end_time"
                rules={[{ required: true, message: t.errRequiredEndTime }]}
              >
                <Select
                  size="large"
                  showSearch
                  popupMatchSelectWidth={false}
                  styles={{ popup: { root: { minWidth: 200 } } }}
                  placeholder={t.fieldEndTimePlaceholder}
                  suffixIcon={<ClockCircleOutlined className="text-slate-400" />}
                  options={TIME_SLOTS_30MIN.map((slot) => ({
                    value: slot,
                    label: <span className="font-mono font-medium">{slot}</span>,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[20, 0]}>
            {/* Số lượng người tham dự */}
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t.fieldAttendeesCount}</span>}
                name="num_attendees"
                rules={[
                  { required: true, message: t.errRequiredAttendees },
                  { type: 'number', min: 1, message: `1 ${t.peopleUnit}` },
                ]}
              >
                <InputNumber
                  min={1}
                  max={selectedRoom ? selectedRoom.capacity : 100}
                  style={{ width: '100%' }}
                  size="large"
                  onChange={(val) => checkCapacity(Number(val))}
                  prefix={<TeamOutlined className="text-slate-400" />}
                />
              </Form.Item>
            </Col>

            {/* Mục đích cuộc họp */}
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t.fieldPurpose}</span>}
                name="purpose"
                rules={[{ required: true, message: t.errRequiredPurpose }]}
              >
                <Input size="large" placeholder={t.fieldPurposePlaceholder} />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '14px 0 20px 0', borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0' }} />

          {/* Danh sách người tham gia */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className={`font-bold text-sm ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>
                  {t.optionalAttendeesTitle}
                </span>
                <span className="block text-xs text-slate-400">
                  {t.optionalAttendeesSub}
                </span>
              </div>
            </div>

            <Form.List name="attendees">
              {(fields, { add, remove }) => (
                <div className="space-y-2.5">
                  {fields.map(({ key, name, ...restField }) => (
                    <div
                      key={key}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row items-stretch sm:items-center gap-2 ${
                        isDark ? 'bg-[#242426] border-white/15' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <Form.Item
                        {...restField}
                        name={[name, 'name']}
                        rules={[{ required: true, message: t.errRequiredName }]}
                        style={{ margin: 0, flex: 1 }}
                      >
                        <Input
                          placeholder={t.attendeeNamePlaceholder}
                          prefix={<UserOutlined className="text-slate-400" />}
                        />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, 'attendee_email']}
                        rules={[
                          { required: true, message: t.errRequiredEmail },
                          { type: 'email', message: t.errInvalidEmail },
                        ]}
                        style={{ margin: 0, flex: 1 }}
                      >
                        <Input placeholder={t.attendeeEmailPlaceholder} />
                      </Form.Item>

                      {fields.length > 1 && (
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(name)}
                          className="self-end sm:self-auto"
                        />
                      )}
                    </div>
                  ))}

                  <Button
                    type="dashed"
                    onClick={() => add({ name: '', attendee_email: '' })}
                    block
                    icon={<PlusOutlined />}
                    style={{ borderRadius: 8 }}
                  >
                    {t.addAttendeeBtn}
                  </Button>
                </div>
              )}
            </Form.List>
          </div>

          {/* Dynamic Summary Preview Box */}
          <div className={`p-4 rounded-xl border mb-6 ${
            isDark ? 'bg-[#242426] border-white/15 text-white' : 'bg-blue-50/50 border-blue-100'
          }`}>
            <span className="text-xs font-bold uppercase tracking-wider text-[#1e40af] dark:text-[#0a84ff] block mb-2">
              {t.summaryTitle}
            </span>
            <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }}>
              <Descriptions.Item label={t.summaryRoom}>
                <strong className="text-[#1e40af] dark:text-[#0a84ff]">{selectedRoom?.name || t.unselected}</strong>
              </Descriptions.Item>
              <Descriptions.Item label={t.summaryDate}>
                {watchedValues?.date ? watchedValues.date.format('DD/MM/YYYY') : '--'}
              </Descriptions.Item>
              <Descriptions.Item label={t.summaryTime}>
                {watchedValues?.start_time && watchedValues?.end_time
                  ? `${watchedValues.start_time} - ${watchedValues.end_time}`
                  : '--'}
              </Descriptions.Item>
              <Descriptions.Item label={t.summaryAttendees}>
                {watchedValues?.num_attendees || 0} {t.peopleUnit}
              </Descriptions.Item>
              <Descriptions.Item label={t.summaryCapacity}>
                {selectedRoom?.capacity || 0} {t.peopleUnit}
              </Descriptions.Item>
              <Descriptions.Item label={t.summaryOrganizer}>
                {user?.name}
              </Descriptions.Item>
            </Descriptions>
          </div>

          {/* Form Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-slate-100 dark:border-white/10">
            <Button
              size="large"
              block
              className="sm:w-auto"
              onClick={() => {
                if (isEditMode) navigate('/my-bookings');
                else if (id) navigate(`/rooms/${id}`);
                else navigate('/rooms');
              }}
              style={{ borderRadius: 8 }}
            >
              {t.cancelBtn}
            </Button>
            <Button
              type="primary"
              size="large"
              block
              className="sm:w-auto"
              htmlType="submit"
              loading={submitting}
              icon={<CheckCircleOutlined />}
              style={{
                backgroundColor: isDark ? '#0a84ff' : '#1e40af',
                borderColor: isDark ? '#0a84ff' : '#1e40af',
                minWidth: 180,
                fontWeight: 600,
                borderRadius: 8,
              }}
            >
              {isEditMode ? t.editBookingBtn : t.confirmBookingBtn}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
};
