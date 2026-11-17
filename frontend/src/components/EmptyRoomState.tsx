import React from 'react';
import { Button, Typography } from 'antd';
import { AppstoreOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export interface EmptyRoomStateProps {
  title: string;
  description: string;
  isDark: boolean;
  primaryActionLabel?: string;
  primaryActionIcon?: React.ReactNode;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

/**
 * Illustrated empty state shown when no meeting rooms exist or match active filters.
 */
export const EmptyRoomState: React.FC<EmptyRoomStateProps> = ({
  title,
  description,
  isDark,
  primaryActionLabel,
  primaryActionIcon,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  return (
    <div
      className={`p-10 sm:p-14 rounded-2xl border border-dashed text-center flex flex-col items-center justify-center transition-all ${
        isDark ? 'bg-[#1c1c1e] border-white/15' : 'bg-white border-slate-300 shadow-2xs'
      }`}
    >
      <div className="relative mb-5">
        <div
          className={`w-24 h-24 rounded-3xl flex items-center justify-center shadow-inner ${
            isDark ? 'bg-white/5 border border-white/10' : 'bg-blue-50/70 border border-blue-100'
          }`}
        >
          <AppstoreOutlined style={{ fontSize: 44, color: isDark ? '#0a84ff' : '#1e40af' }} />
        </div>
        <div
          className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
            isDark ? 'bg-[#27272a] border-[#1c1c1e] text-zinc-400' : 'bg-white border-white text-slate-400 shadow-xs'
          }`}
        >
          0
        </div>
      </div>

      <Title level={4} className={`!mb-2 ${isDark ? '!text-white' : '!text-slate-800'}`}>
        {title}
      </Title>

      <Text className={`max-w-md text-sm mb-6 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
        {description}
      </Text>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {primaryActionLabel && onPrimaryAction && (
          <Button
            type="primary"
            icon={primaryActionIcon}
            onClick={onPrimaryAction}
            style={{
              backgroundColor: isDark ? '#0a84ff' : '#1e40af',
              borderColor: isDark ? '#0a84ff' : '#1e40af',
              height: 40,
              borderRadius: 8,
              fontWeight: 600,
              padding: '0 20px',
            }}
          >
            {primaryActionLabel}
          </Button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <Button
            onClick={onSecondaryAction}
            icon={<ReloadOutlined />}
            style={{
              height: 40,
              borderRadius: 8,
              fontWeight: 500,
            }}
          >
            {secondaryActionLabel}
          </Button>
        )}
      </div>
    </div>
  );
};
