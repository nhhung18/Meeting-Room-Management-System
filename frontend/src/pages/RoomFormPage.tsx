import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  App,
  Spin,
  Tag,

  Upload,
  Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  PlusOutlined,
  CloseOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  ToolOutlined,
  InfoCircleOutlined,
  UserOutlined,
  PictureOutlined,
  DeleteOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import {
  Room,
  STANDARD_EQUIPMENT,
  ROOM_STATUS_CONFIG,
  getRoomStatusLabel,
  getEquipmentLabel,
} from '../types';
import { getRoomById, createRoom, updateRoom, uploadRoomImage, deleteRoomImage } from '../api/rooms';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

// ── Equipment chip selector ────────────────────────────────────────────────────
const EquipmentChipGroup: React.FC<{
  value?: string[];
  onChange?: (val: string[]) => void;
  language: string;
  isDark: boolean;
}> = ({ value = [], onChange, language, isDark }) => {
  const toggle = (eq: string) =>
    onChange?.(value.includes(eq) ? value.filter((v) => v !== eq) : [...value, eq]);

  return (
    <div className="flex flex-wrap gap-2">
      {STANDARD_EQUIPMENT.map((eq) => {
        const selected = value.includes(eq);
        return (
          <button
            key={eq}
            type="button"
            onClick={() => toggle(eq)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer select-none ${
              selected
                ? isDark
                  ? 'bg-[#0a84ff]/20 border-[#0a84ff] text-[#0a84ff]'
                  : 'bg-blue-50 border-[#1e40af] text-[#1e40af]'
                : isDark
                ? 'bg-white/5 border-white/15 text-zinc-400 hover:border-white/30 hover:text-zinc-200'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'
            }`}
          >
            {selected && <CheckOutlined style={{ fontSize: 10 }} />}
            {getEquipmentLabel(eq, language as 'vi' | 'en')}
          </button>
        );
      })}
    </div>
  );
};

// ── Custom equipment removable tags ───────────────────────────────────────────
const CustomEquipmentTags: React.FC<{
  value?: string[];
  onChange?: (val: string[]) => void;
  isDark: boolean;
  language: string;
}> = ({ value = [], onChange, isDark, language }) => {
  const customItems = value.filter((v) => !STANDARD_EQUIPMENT.includes(v));
  if (customItems.length === 0) return null;
  const remove = (eq: string) => onChange?.(value.filter((v) => v !== eq));

  return (
    <div className="mt-3">
      <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
        {language === 'vi' ? 'Thiết bị tuỳ chỉnh' : 'Custom equipment'}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {customItems.map((eq) => (
          <span
            key={eq}
            className={`flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-medium border ${
              isDark
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
          >
            {getEquipmentLabel(eq, language as 'vi' | 'en')}
            <button
              type="button"
              onClick={() => remove(eq)}
              className={`w-4 h-4 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                isDark ? 'hover:bg-amber-500/30 text-amber-400' : 'hover:bg-amber-200 text-amber-600'
              }`}
            >
              <CloseOutlined style={{ fontSize: 9 }} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};

// ── Room preview card (with integrated image upload) ──────────────────────────
const RoomPreviewCard: React.FC<{
  values: Partial<Room>;
  isDark: boolean;
  language: string;
  isNew: boolean;
  imageUrl?: string | null;
  hasNewImage?: boolean;
  imageUploading?: boolean;
  deletingImage?: boolean;
  isEdit?: boolean;
  existingImageUrl?: string | null;
  onFileSelect?: (file: File) => boolean;
  onClearNewImage?: () => void;
  onDeleteExistingImage?: () => void;
}> = ({
  values,
  isDark,
  language,
  isNew,
  imageUrl,
  hasNewImage,
  imageUploading,
  deletingImage,
  isEdit,
  existingImageUrl,
  onFileSelect,
  onClearNewImage,
  onDeleteExistingImage,
}) => {
  const status = (values.status as any) || 'AVAILABLE';
  const cfg = ROOM_STATUS_CONFIG[status as keyof typeof ROOM_STATUS_CONFIG];

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#1c1c1e] border-white/15' : 'bg-white border-slate-200 shadow-sm'}`}>
      {/* Photo area — integrated upload */}
      <div className={`w-full relative border-b ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
        {imageUrl ? (
          // Has image: show image with action buttons
          <div className="relative">
            <img src={imageUrl} alt={values.name || 'room'} className="w-full h-48 object-cover" />
            {/* Overlay actions */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-2.5 right-2.5 flex gap-1.5">
              {hasNewImage ? (
                <button
                  type="button"
                  onClick={onClearNewImage}
                  className="bg-black/60 hover:bg-black/80 text-white rounded-lg px-2.5 py-1 text-xs flex items-center gap-1 transition-colors backdrop-blur-sm"
                >
                  <CloseOutlined style={{ fontSize: 10 }} />
                  {language === 'vi' ? 'Bỏ chọn' : 'Clear'}
                </button>
              ) : isEdit && existingImageUrl ? (
                <Popconfirm
                  title={language === 'vi' ? 'Xác nhận xóa ảnh phòng này?' : "Remove this room's image?"}
                  onConfirm={onDeleteExistingImage}
                  okText={language === 'vi' ? 'Xóa' : 'Remove'}
                  cancelText={language === 'vi' ? 'Hủy' : 'Cancel'}
                  okButtonProps={{ danger: true }}
                >
                  <button
                    type="button"
                    className="bg-red-600/80 hover:bg-red-700 text-white rounded-lg px-2.5 py-1 text-xs flex items-center gap-1 transition-colors backdrop-blur-sm"
                  >
                    <DeleteOutlined style={{ fontSize: 10 }} />
                    {language === 'vi' ? 'Xóa ảnh' : 'Remove'}
                  </button>
                </Popconfirm>
              ) : null}
              {/* Change image button */}
              <Upload
                accept="image/jpeg,image/png,image/webp"
                showUploadList={false}
                beforeUpload={onFileSelect}
                multiple={false}
              >
                <button
                  type="button"
                  className="bg-black/60 hover:bg-black/80 text-white rounded-lg px-2.5 py-1 text-xs flex items-center gap-1 transition-colors backdrop-blur-sm"
                >
                  <PictureOutlined style={{ fontSize: 10 }} />
                  {language === 'vi' ? 'Đổi ảnh' : 'Change'}
                </button>
              </Upload>
            </div>
          </div>
        ) : (
          // No image: upload zone
          <Upload.Dragger
            accept="image/jpeg,image/png,image/webp"
            showUploadList={false}
            beforeUpload={onFileSelect}
            multiple={false}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 0,
            }}
          >
            <div className={`h-44 flex flex-col items-center justify-center gap-3 ${isDark ? 'bg-[#242426]' : 'bg-slate-50'}`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                <InboxOutlined style={{ fontSize: 22, color: isDark ? '#0a84ff' : '#1e40af' }} />
              </div>
              <div className="text-center">
                <p className={`text-xs font-semibold ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                  {language === 'vi' ? 'Kéo thả hoặc bấm để tải ảnh' : 'Drag & drop or click to upload'}
                </p>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                  JPEG · PNG · WebP · {language === 'vi' ? 'tối đa 10MB' : 'max 10MB'}
                </p>
              </div>
            </div>
          </Upload.Dragger>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Status + capacity row */}
        <div className="flex items-center justify-between gap-2">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 ${isDark ? 'bg-white/5 border border-white/10 text-zinc-200' : 'bg-slate-100 text-slate-700'}`}>
            <TeamOutlined className={isDark ? 'text-[#0a84ff]' : 'text-[#1e40af]'} />
            {values.capacity || '—'} {language === 'vi' ? 'người' : 'pax'}
          </span>
          <Tag color={cfg?.color || 'default'} className="m-0 font-semibold text-xs">
            {getRoomStatusLabel(status, language as any)}
          </Tag>
        </div>

        {/* Name */}
        <div className={`font-bold text-lg leading-tight ${isDark ? 'text-white' : 'text-slate-800'} ${!values.name ? 'opacity-30' : ''}`}>
          {values.name || (language === 'vi' ? 'Tên phòng họp' : 'Meeting room name')}
        </div>

        {/* Floor */}
        <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
          <EnvironmentOutlined className={isDark ? 'text-[#0a84ff]' : 'text-[#1e40af]'} />
          {values.floor || (language === 'vi' ? 'Chưa có vị trí' : 'No location set')}
        </div>

        {/* Equipment chips preview */}
        {(values.equipment || []).length > 0 && (
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
              {language === 'vi' ? 'Thiết bị' : 'Equipment'}
            </p>
            <div className="flex flex-wrap gap-1">
              {(values.equipment || []).slice(0, 6).map((eq, i) => (
                <span key={i} className={`text-[11px] px-1.5 py-0.5 rounded border ${isDark ? 'bg-white/5 border-white/10 text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  {getEquipmentLabel(eq, language as 'vi' | 'en')}
                </span>
              ))}
              {(values.equipment || []).length > 6 && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${isDark ? 'text-[#0a84ff]' : 'text-[#1e40af]'}`}>
                  +{(values.equipment || []).length - 6}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Badge: new / editing */}
        <div className={`pt-2 border-t text-[11px] font-medium ${isDark ? 'border-white/8 text-zinc-500' : 'border-slate-100 text-slate-400'}`}>
          {isNew
            ? (language === 'vi' ? '✦ Phòng họp mới' : '✦ New meeting room')
            : (language === 'vi' ? '✎ Đang chỉnh sửa' : '✎ Editing existing room')}
        </div>
      </div>
    </div>
  );
};

// ── Section card wrapper ───────────────────────────────────────────────────────
const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  isDark: boolean;
  children: React.ReactNode;
}> = ({ icon, title, isDark, children }) => (
  <div className={`rounded-2xl border ${isDark ? 'bg-[#1c1c1e] border-white/15' : 'bg-white border-slate-200'}`}>
    <div className={`px-5 py-3.5 border-b flex items-center gap-2.5 ${isDark ? 'border-white/8' : 'border-slate-100'}`}>
      <span className={isDark ? 'text-[#0a84ff]' : 'text-[#1e40af]'}>{icon}</span>
      <span className={`font-semibold text-xs uppercase tracking-wider ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>{title}</span>
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
);

// ── Main page ──────────────────────────────────────────────────────────────────
export const RoomFormPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { language } = useLanguage();
  const { message } = App.useApp();

  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loadingRoom, setLoadingRoom] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [customEquipment, setCustomEquipment] = useState('');
  const [preview, setPreview] = useState<Partial<Room>>({
    status: 'AVAILABLE',
    capacity: 10,
    equipment: [],
  });

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [deletingImage, setDeletingImage] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  // Load existing room for edit
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const room = await getRoomById(Number(id));
        form.setFieldsValue({
          name: room.name,
          capacity: room.capacity,
          status: room.status,
          floor: room.floor,
          owner_id: room.owner_id,
          description: room.description,
          equipment: room.equipment,
        });
        setPreview(room);
        setExistingImageUrl(room.image_url ?? null);
      } catch {
        message.error(language === 'vi' ? 'Không tải được thông tin phòng' : 'Failed to load room');
        navigate('/rooms');
      } finally {
        setLoadingRoom(false);
      }
    })();
  }, [id]);

  // Sync preview with form values on change
  const handleValuesChange = (_: unknown, all: Partial<Room>) => setPreview(all);

  const handleAddCustomEquipment = () => {
    if (!customEquipment.trim()) return;
    const current: string[] = form.getFieldValue('equipment') || [];
    if (!current.includes(customEquipment.trim())) {
      const next = [...current, customEquipment.trim()];
      form.setFieldsValue({ equipment: next });
      setPreview((p) => ({ ...p, equipment: next }));
    }
    setCustomEquipment('');
  };

  const handleFileSelect = (file: File) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
    const MAX_BYTES = 10 * 1024 * 1024;
    if (!ALLOWED.includes(file.type)) {
      message.error(language === 'vi' ? 'Chỉ chấp nhận JPEG, PNG, WebP' : 'Only JPEG, PNG, WebP allowed');
      return false;
    }
    if (file.size > MAX_BYTES) {
      message.error(language === 'vi' ? 'Ảnh vượt quá 10MB' : 'Image exceeds 10MB limit');
      return false;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImageFile(file);
    setImagePreviewUrl(url);
    return false;
  };

  const handleClearNewImage = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const handleDeleteImage = async () => {
    if (!isEdit || !id) return;
    setDeletingImage(true);
    try {
      await deleteRoomImage(Number(id));
      setExistingImageUrl(null);
      setImageFile(null);
      setImagePreviewUrl(null);
      message.success(language === 'vi' ? 'Đã xóa ảnh phòng' : 'Room image removed');
    } catch (err: any) {
      message.error(err?.message || (language === 'vi' ? 'Lỗi khi xóa ảnh' : 'Failed to remove image'));
    } finally {
      setDeletingImage(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        name: values.name,
        capacity: values.capacity,
        status: values.status,
        floor: values.floor || undefined,
        owner_id: values.owner_id || undefined,
        description: values.description || undefined,
        equipment: values.equipment || [],
      };

      let roomId: number;
      if (isEdit) {
        await updateRoom(Number(id), payload);
        roomId = Number(id);
      } else {
        const created = await createRoom(payload);
        roomId = created.id;
      }

      if (imageFile) {
        setImageUploading(true);
        try {
          await uploadRoomImage(roomId, imageFile);
        } catch (imgErr: any) {
          message.error(imgErr?.message || (language === 'vi' ? 'Lỗi khi tải ảnh lên' : 'Failed to upload image'));
        } finally {
          setImageUploading(false);
        }
      }

      message.success(isEdit
        ? (language === 'vi' ? 'Cập nhật phòng thành công' : 'Room updated successfully')
        : (language === 'vi' ? 'Tạo phòng họp thành công' : 'Room created successfully')
      );
      navigate('/rooms');
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.message || (language === 'vi' ? 'Lỗi khi lưu phòng' : 'Error saving room'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingRoom) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-full space-y-7">
      {/* Top bar: back button + save action */}
      <div className="flex items-center justify-between">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/rooms')}
          style={{ paddingLeft: 0, color: isDark ? '#0a84ff' : '#1e40af', fontWeight: 600 }}
        >
          {language === 'vi' ? 'Quay lại danh sách phòng' : 'Back to room list'}
        </Button>

        <Button
          type="primary"
          icon={isEdit ? <CheckOutlined /> : <PlusOutlined />}
          loading={submitting || imageUploading || deletingImage}
          onClick={handleSubmit}
          style={{
            backgroundColor: isDark ? '#0a84ff' : '#1e40af',
            borderColor: isDark ? '#0a84ff' : '#1e40af',
            borderRadius: 10,
            fontWeight: 600,
            minWidth: 130,
          }}
        >
          {isEdit
            ? (language === 'vi' ? 'Lưu thay đổi' : 'Save Changes')
            : (language === 'vi' ? 'Tạo phòng họp' : 'Create Room')}
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Left: form sections */}
        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
          onValuesChange={handleValuesChange}
          initialValues={{ status: 'AVAILABLE', capacity: 10, equipment: [] }}
          className="space-y-5"
        >
          {/* Basic info */}
          <SectionCard
            icon={<InfoCircleOutlined />}
            title={language === 'vi' ? 'Thông tin cơ bản' : 'Basic Information'}
            isDark={isDark}
          >
            <Form.Item
              label={<span className={`font-semibold text-xs ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>{language === 'vi' ? 'Tên phòng họp' : 'Room name'}</span>}
              name="name"
              rules={[{ required: true, message: language === 'vi' ? 'Vui lòng nhập tên phòng' : 'Please enter room name' }]}
              style={{ marginBottom: 0 }}
            >
              <Input
                placeholder={language === 'vi' ? 'VD: Phòng họp Hà Nội A' : 'e.g. Hanoi Conference Room A'}
                size="large"
                style={{ borderRadius: 10 }}
              />
            </Form.Item>

            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                label={
                  <span className={`font-semibold text-xs ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                    <TeamOutlined className="mr-1" />{language === 'vi' ? 'Sức chứa' : 'Capacity'}
                  </span>
                }
                name="capacity"
                rules={[
                  { required: true, message: language === 'vi' ? 'Nhập sức chứa' : 'Enter capacity' },
                  { type: 'number', min: 1, message: language === 'vi' ? 'Tối thiểu 1 người' : 'Min 1' },
                ]}
                style={{ marginBottom: 0 }}
              >
                <InputNumber
                  min={1} max={500}
                  size="large"
                  style={{ width: '100%', borderRadius: 10 }}
                  addonAfter={<span className="text-xs text-slate-400">{language === 'vi' ? 'người' : 'pax'}</span>}
                />
              </Form.Item>

              <Form.Item
                label={<span className={`font-semibold text-xs ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>{language === 'vi' ? 'Trạng thái' : 'Status'}</span>}
                name="status"
                rules={[{ required: true }]}
                style={{ marginBottom: 0 }}
              >
                <Select
                  size="large"
                  style={{ borderRadius: 10 }}
                  options={[
                    { value: 'AVAILABLE', label: <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />{language === 'vi' ? 'Hoạt động' : 'Available'}</span> },
                    { value: 'MAINTENANCE', label: <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5" />{language === 'vi' ? 'Bảo trì' : 'Maintenance'}</span> },
                    { value: 'ARCHIVED', label: <span><span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1.5" />{language === 'vi' ? 'Lưu trữ' : 'Archived'}</span> },
                  ]}
                />
              </Form.Item>
            </div>

            <Form.Item
              label={<span className={`font-semibold text-xs ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>{language === 'vi' ? 'Mô tả' : 'Description'}</span>}
              name="description"
              style={{ marginBottom: 0 }}
            >
              <Input.TextArea
                placeholder={language === 'vi' ? 'Mô tả ngắn về phòng họp...' : 'Brief description of this room...'}
                rows={2}
                style={{ borderRadius: 10 }}
              />
            </Form.Item>
          </SectionCard>

          {/* Location & Manager */}
          <SectionCard
            icon={<EnvironmentOutlined />}
            title={language === 'vi' ? 'Vị trí & Quản lý' : 'Location & Manager'}
            isDark={isDark}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Form.Item
                label={<span className={`font-semibold text-xs ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>{language === 'vi' ? 'Tầng / Vị trí' : 'Floor / Location'}</span>}
                name="floor"
                style={{ marginBottom: 0 }}
              >
                <Input
                  placeholder={language === 'vi' ? 'VD: Tầng 3, Toà A' : 'e.g. Floor 3, Building A'}
                  size="large"
                  style={{ borderRadius: 10 }}
                  prefix={<EnvironmentOutlined className="text-slate-400" />}
                />
              </Form.Item>

              <Form.Item
                label={<span className={`font-semibold text-xs ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>{language === 'vi' ? 'Quản lý phụ trách' : 'Manager in charge'}</span>}
                name="owner_id"
                style={{ marginBottom: 0 }}
              >
                <Input
                  placeholder={language === 'vi' ? 'Email hoặc ID quản lý' : 'Manager email or ID'}
                  size="large"
                  style={{ borderRadius: 10 }}
                  prefix={<UserOutlined className="text-slate-400" />}
                />
              </Form.Item>
            </div>
          </SectionCard>

          {/* Equipment */}
          <SectionCard
            icon={<ToolOutlined />}
            title={language === 'vi' ? 'Thiết bị sẵn có' : 'Available Equipment'}
            isDark={isDark}
          >
            <div>
              <p className={`text-xs mb-3 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                {language === 'vi' ? 'Nhấn để chọn / bỏ chọn' : 'Click to select / deselect'}
              </p>
              <Form.Item name="equipment" noStyle>
                <EquipmentChipGroup language={language} isDark={isDark} />
              </Form.Item>
            </div>

            {/* Custom equipment */}
            <div className={`pt-4 border-t ${isDark ? 'border-white/8' : 'border-slate-100'}`}>
              <p className={`text-xs font-semibold mb-2.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                {language === 'vi' ? 'Thêm thiết bị tuỳ chỉnh' : 'Add custom equipment'}
              </p>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder={language === 'vi' ? 'Nhập tên thiết bị...' : 'Enter equipment name...'}
                  value={customEquipment}
                  onChange={(e) => setCustomEquipment(e.target.value)}
                  onPressEnter={handleAddCustomEquipment}
                  style={{ borderRadius: '10px 0 0 10px' }}
                />
                <Button
                  onClick={handleAddCustomEquipment}
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={!customEquipment.trim()}
                  style={{
                    borderRadius: '0 10px 10px 0',
                    backgroundColor: isDark ? '#0a84ff' : '#1e40af',
                    borderColor: isDark ? '#0a84ff' : '#1e40af',
                  }}
                >
                  {language === 'vi' ? 'Thêm' : 'Add'}
                </Button>
              </Space.Compact>

              <Form.Item name="equipment" noStyle>
                <CustomEquipmentTags isDark={isDark} language={language} />
              </Form.Item>
            </div>
          </SectionCard>
        </Form>

        {/* Right: live preview + summary */}
        <div className="space-y-5 lg:sticky lg:top-20">
          <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
            {language === 'vi' ? 'Xem trước' : 'Live preview'}
          </p>

          <RoomPreviewCard
            values={preview}
            isDark={isDark}
            language={language}
            isNew={!isEdit}
            imageUrl={imagePreviewUrl || existingImageUrl}
            hasNewImage={!!imagePreviewUrl}
            imageUploading={imageUploading}
            deletingImage={deletingImage}
            isEdit={isEdit}
            existingImageUrl={existingImageUrl}
            onFileSelect={handleFileSelect}
            onClearNewImage={handleClearNewImage}
            onDeleteExistingImage={handleDeleteImage}
          />
        </div>
      </div>
    </div>
  );
};
