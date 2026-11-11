import React from 'react';
import { Result, Button } from 'antd';
import { ReloadOutlined, DisconnectOutlined, LockOutlined, FileSearchOutlined, AlertOutlined } from '@ant-design/icons';
import { useLanguage, Translations } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export interface ApiErrorStateProps {
  error: { status?: number; detail?: string; message?: string };
  onRetry?: () => void;
}

export interface ErrorConfig {
  title: string;
  description?: string;
  showRetry: boolean;
  statusType: 'error' | 'warning' | 'info' | '403' | '404' | '500';
}

/**
 * Pure function to map HTTP/API error status to user-friendly titles and retry options
 */
export const getErrorConfig = (
  status: number | undefined,
  detail: string | undefined,
  t: Translations
): ErrorConfig => {
  const code = status ?? 0;

  if (code === 0) {
    return {
      title: t.errNetworkTitle,
      description: t.errNetworkHint,
      showRetry: true,
      statusType: '500',
    };
  }

  if (code === 401) {
    return {
      title: t.errUnauthorizedTitle,
      description: t.errUnauthorizedHint,
      showRetry: false,
      statusType: '403',
    };
  }

  if (code === 403) {
    return {
      title: t.errForbiddenTitle,
      description: detail && detail !== t.errForbiddenTitle ? detail : undefined,
      showRetry: false,
      statusType: '403',
    };
  }

  if (code === 404) {
    return {
      title: t.errNotFoundTitle,
      description: detail && detail !== t.errNotFoundTitle ? detail : undefined,
      showRetry: false,
      statusType: '404',
    };
  }

  if (code === 409) {
    return {
      title: detail || t.errGenericTitle,
      description: undefined,
      showRetry: false,
      statusType: 'warning',
    };
  }

  return {
    title: detail || t.errGenericTitle,
    description: undefined,
    showRetry: true,
    statusType: 'error',
  };
};

export const ApiErrorState: React.FC<ApiErrorStateProps> = ({ error, onRetry }) => {
  const { t } = useLanguage();
  const { isDark } = useTheme();

  const status = error.status ?? 0;
  const detail = error.detail || error.message || '';
  const config = getErrorConfig(status, detail, t);

  const getCustomIcon = () => {
    if (status === 0) {
      return <DisconnectOutlined style={{ color: '#ff453a', fontSize: 48 }} />;
    }
    if (status === 401) {
      return <LockOutlined style={{ color: '#ff453a', fontSize: 48 }} />;
    }
    if (status === 403) {
      return <LockOutlined style={{ color: '#ff9f0a', fontSize: 48 }} />;
    }
    if (status === 404) {
      return <FileSearchOutlined style={{ color: '#8e8e93', fontSize: 48 }} />;
    }
    return <AlertOutlined style={{ color: '#ff453a', fontSize: 48 }} />;
  };

  return (
    <div
      className={`my-6 p-6 sm:p-10 rounded-2xl border text-center transition-all ${
        isDark
          ? 'bg-[#1c1c1e] border-white/10 text-white shadow-lg'
          : 'bg-white border-slate-200 text-slate-800 shadow-sm'
      }`}
    >
      <Result
        icon={getCustomIcon()}
        title={
          <span className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
            {config.title}
          </span>
        }
        subTitle={
          config.description ? (
            <span className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
              {config.description}
            </span>
          ) : undefined
        }
        extra={
          config.showRetry && onRetry ? (
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={onRetry}
              style={{
                backgroundColor: isDark ? '#0a84ff' : '#1e40af',
                borderColor: isDark ? '#0a84ff' : '#1e40af',
                borderRadius: 8,
                fontWeight: 600,
                padding: '0 20px',
                height: 38,
              }}
            >
              {t.errRetryBtn}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
};

export default ApiErrorState;
