import React, { useState, useEffect, useMemo } from 'react';
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
  Tooltip,
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
  VideoCameraOutlined,
  GlobalOutlined,
  EnvironmentOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { Room, BookingPolicyConfig, Booking, MeetingType } from '../types';
import { getRooms, createBooking, getBookingById, updateBooking, getBookings } from '../api/client';
import { getBookingPolicies } from '../api/policies';
import { ApiErrorState } from '../components/ApiErrorState';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import {
  TIME_SLOTS_15MIN,
  TIME_INPUT_REGEX,
  isBookingDateDisabled,
  parseAndFormatCustomTime,
  mergeCustomTimeOptions,
} from '../utils/bookingDateTime';

const { Title, Text } = Typography;

export { TIME_SLOTS_15MIN };
export const TIME_SLOTS_30MIN = TIME_SLOTS_15MIN;

interface BookingFormValues {
  room_id: number;
  date: Dayjs;
  start_time: string;
  end_time: string;
  num_attendees: number;
  title: string;
  purpose?: string;
  meeting_type: MeetingType;
  meeting_link?: string;
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
  const [startSearchText, setStartSearchText] = useState('');
  const [endSearchText, setEndSearchText] = useState('');
  const [myBookings, setMyBookings] = useState<Booking[]>([]);

  // Watch fields for live summary
  const watchedValues = Form.useWatch([], form);

  const fetchFormData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load organization policies and user's existing bookings in parallel
      const [policyData, myBookingsRes] = await Promise.all([
        getBookingPolicies(),
        getBookings({ limit: 100 }),
      ]);
      setPolicies(policyData);
      setMyBookings(myBookingsRes.items.filter((b) => b.status !== 'CANCELLED'));

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
          title: existing.title || '',
          purpose: existing.purpose || '',
          meeting_type: (existing.meeting_type as MeetingType) || 'OFFLINE',
          meeting_link: existing.meeting_link || '',
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

        const parsedParam = timeParam ? parseAndFormatCustomTime(timeParam) : null;
        if (parsedParam) {
          const nextSlot = dayjs(`2000-01-01T${parsedParam}:00`).add(60, 'minute').format('HH:mm');
          form.setFieldsValue({
            start_time: parsedParam,
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
      if (err?.status === 401) return;
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

  const disabledDate = (current: Dayjs) =>
    isBookingDateDisabled(current, policies?.max_advance_days);

  const buildTimeOptions = (searchText: string, currentValue?: string) => {
    const customTag = language === 'vi' ? '(Tùy chỉnh)' : '(Custom)';
    return mergeCustomTimeOptions(searchText, currentValue).map(({ value, isCustom }) => ({
      value,
      label: (
        <span className="font-mono font-medium flex items-center justify-between">
          <span>{value}</span>
          {isCustom && (
            <span className="text-[10px] text-[#1e40af] dark:text-[#0a84ff] ml-2">
              {customTag}
            </span>
          )}
        </span>
      ),
    }));
  };

  const startTimeOptions = useMemo(
    () => buildTimeOptions(startSearchText, watchedValues?.start_time),
    [startSearchText, watchedValues?.start_time, language]
  );

  const endTimeOptions = useMemo(
    () => buildTimeOptions(endSearchText, watchedValues?.end_time),
    [endSearchText, watchedValues?.end_time, language]
  );

  const handleTimeBlur = (
    field: 'start_time' | 'end_time',
    searchText: string,
    clearSearch: () => void
  ) => {
    const formatted = parseAndFormatCustomTime(searchText);
    if (formatted) {
      form.setFieldValue(field, formatted);
      clearSearch();
    }
  };

  const datePickerCellRender = (current: string | number | Dayjs, info: { type: string; originNode: React.ReactElement }) => {
    if (info.type !== 'date' || typeof current !== 'object') return info.originNode;
    const dateStr = (current as Dayjs).format('YYYY-MM-DD');
    const dayBookings = myBookings.filter(
      (b) => dayjs(b.start_at).format('YYYY-MM-DD') === dateStr
    );
    if (dayBookings.length === 0) return info.originNode;

    const tooltipContent = (
      <div className="min-w-[180px]">
        <div className="font-semibold text-xs mb-1 text-slate-200">
          {language === 'vi' ? `Lịch họp ngày ${(current as Dayjs).format('DD/MM')}` : `Meetings on ${(current as Dayjs).format('MM/DD')}`}
        </div>
        {dayBookings.map((b) => (
          <div key={b.id} className="text-[11px] text-slate-300 py-0.5 border-b border-white/10 last:border-0">
            <span className="font-mono">{dayjs(b.start_at).format('HH:mm')}–{dayjs(b.end_at).format('HH:mm')}</span>
            {b.room_name ? <span className="ml-1 opacity-70">· {b.room_name}</span> : null}
            {b.purpose ? <div className="truncate opacity-80">{b.purpose}</div> : null}
          </div>
        ))}
      </div>
    );

    return (
      <Tooltip title={tooltipContent} placement="right" overlayStyle={{ maxWidth: 240 }}>
        <div className="relative inline-flex flex-col items-center w-full">
          {info.originNode}
          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500" />
        </div>
      </Tooltip>
    );
  };

  const onFinish = async (values: BookingFormValues) => {
    try {
      setSubmitting(true);

      const dateStr = values.date.format('YYYY-MM-DD');
      const startStr = typeof values.start_time === 'string' ? values.start_time : '17:00';
      const endStr = typeof values.end_time === 'string' ? values.end_time : '17:30';

      // Parse as local time — toTzAwareIso will convert to UTC ISO string
      const startAt = `${dateStr}T${startStr}:00`;
      const endAt = `${dateStr}T${endStr}:00`;

      const startDayjs = dayjs(startAt);
      const endDayjs = dayjs(endAt);

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
        await updateBooking(Number(bookingId), {
          room_id: values.room_id,
          start_at: startAt,
          end_at: endAt,
          num_attendees: values.num_attendees,
          title: values.title || undefined,
          purpose: values.purpose || undefined,
          meeting_type: values.meeting_type,
          meeting_link: values.meeting_link || null,
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
          title: values.title || undefined,
          purpose: values.purpose || undefined,
          meeting_type: values.meeting_type,
          meeting_link: values.meeting_link || null,
          attendees: (values.attendees || []).map((att) => ({
            name: att.name,
            attendee_email: att.attendee_email,
          })),
        });
        message.success(t.bookingSuccess);
        navigate('/my-bookings');
      }
    } catch (err: any) {
      if (err?.status === 401) return;
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
      <div className="space-y-4">
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
    <div className="space-y-4 pb-4">
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
                extra={
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                    <InfoCircleOutlined />
                    <span>{t.maxAdvanceDateHint}</span>
                  </div>
                }
              >
                <DatePicker
                  size="large"
                  style={{ width: '100%' }}
                  format="DD/MM/YYYY"
                  disabledDate={disabledDate}
                  placeholder={t.fieldDatePlaceholder}
                  prefix={<CalendarOutlined className="text-slate-400" />}
                  cellRender={datePickerCellRender}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Khung giờ: Giờ bắt đầu & Giờ kết thúc */}
          <Row gutter={[20, 0]}>
            {[
              {
                name: 'start_time' as const,
                label: t.fieldStartTime,
                placeholder: t.fieldStartTimePlaceholder,
                requiredMsg: t.errRequiredStartTime,
                searchText: startSearchText,
                setSearchText: setStartSearchText,
                options: startTimeOptions,
              },
              {
                name: 'end_time' as const,
                label: t.fieldEndTime,
                placeholder: t.fieldEndTimePlaceholder,
                requiredMsg: t.errRequiredEndTime,
                searchText: endSearchText,
                setSearchText: setEndSearchText,
                options: endTimeOptions,
              },
            ].map((fieldCfg) => (
              <Col xs={24} sm={12} key={fieldCfg.name}>
                <Form.Item
                  label={<span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{fieldCfg.label}</span>}
                  name={fieldCfg.name}
                  rules={[
                    { required: true, message: fieldCfg.requiredMsg },
                    {
                      pattern: TIME_INPUT_REGEX,
                      message: language === 'vi' ? 'Định dạng giờ không hợp lệ (HH:mm)' : 'Invalid time format (HH:mm)',
                    },
                  ]}
                >
                  <Select
                    size="large"
                    showSearch
                    popupMatchSelectWidth={false}
                    styles={{ popup: { root: { minWidth: 200 } } }}
                    placeholder={fieldCfg.placeholder}
                    suffixIcon={<ClockCircleOutlined className="text-slate-400" />}
                    searchValue={fieldCfg.searchText}
                    onSearch={(val) => fieldCfg.setSearchText(val)}
                    onSelect={() => fieldCfg.setSearchText('')}
                    onBlur={() =>
                      handleTimeBlur(fieldCfg.name, fieldCfg.searchText, () =>
                        fieldCfg.setSearchText('')
                      )
                    }
                    filterOption={(input, option) => {
                      if (!input) return true;
                      return String(option?.value || '').includes(input.trim());
                    }}
                    options={fieldCfg.options}
                  />
                </Form.Item>
              </Col>
            ))}
          </Row>

          <div className="text-[11px] text-slate-400 -mt-3 mb-4 flex items-center gap-1.5">
            <InfoCircleOutlined />
            <span>{t.timePickerHint}</span>
          </div>

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

            {/* Tiêu đề cuộc họp */}
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t.fieldTitle}</span>}
                name="title"
                rules={[{ required: true, message: language === 'vi' ? 'Vui lòng nhập tiêu đề cuộc họp' : 'Please enter a meeting title' }]}
              >
                <Input size="large" placeholder={t.fieldTitlePlaceholder} maxLength={255} />
              </Form.Item>
            </Col>
          </Row>

          {/* Nội dung / Mô tả */}
          <Form.Item
            label={<span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t.fieldPurpose}</span>}
            name="purpose"
          >
            <Input.TextArea size="large" placeholder={t.fieldPurposePlaceholder} rows={2} maxLength={500} />
          </Form.Item>

          {/* Hình thức họp */}
          <Form.Item
            label={<span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t.fieldMeetingType}</span>}
            name="meeting_type"
            initialValue="OFFLINE"
          >
            <Select
              size="large"
              options={[
                {
                  value: 'OFFLINE',
                  label: (
                    <span className="flex items-center gap-2">
                      <EnvironmentOutlined className="text-green-500" />
                      {t.meetingTypeOffline}
                    </span>
                  ),
                },
                {
                  value: 'ONLINE',
                  label: (
                    <span className="flex items-center gap-2">
                      <GlobalOutlined className="text-blue-500" />
                      {t.meetingTypeOnline}
                    </span>
                  ),
                },
                {
                  value: 'HYBRID',
                  label: (
                    <span className="flex items-center gap-2">
                      <VideoCameraOutlined className="text-purple-500" />
                      {t.meetingTypeHybrid}
                    </span>
                  ),
                },
              ]}
            />
          </Form.Item>

          {/* Link họp — hiện khi Online/Hybrid */}
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.meeting_type !== curr.meeting_type}
          >
            {({ getFieldValue }) =>
              getFieldValue('meeting_type') !== 'OFFLINE' ? (
                <Form.Item
                  label={
                    <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      <LinkOutlined className="mr-1" />
                      {t.fieldMeetingLink}
                    </span>
                  }
                  name="meeting_link"
                  rules={[
                    { required: true, message: language === 'vi' ? 'Vui lòng nhập link họp' : 'Please enter meeting link' },
                    { type: 'url', message: language === 'vi' ? 'Link không hợp lệ' : 'Invalid URL format' },
                  ]}
                >
                  <Input
                    size="large"
                    placeholder={t.fieldMeetingLinkPlaceholder}
                    maxLength={500}
                    prefix={<LinkOutlined className="text-slate-400" />}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>

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
              <Descriptions.Item label={t.fieldTitle}>
                {watchedValues?.title || '--'}
              </Descriptions.Item>
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
