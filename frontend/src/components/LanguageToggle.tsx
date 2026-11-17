import React from 'react';
import { Tooltip } from 'antd';
import { useLanguage } from '../context/LanguageContext';
import { GlobeIcon } from './ThemeIcons';

interface LanguageToggleProps {
  className?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ className = '' }) => {
  const { language, toggleLanguage } = useLanguage();

  return (
    <Tooltip
      title={
        language === 'vi'
          ? 'Switch to English'
          : 'Chuyển sang Tiếng Việt'
      }
    >
      <button
        type="button"
        onClick={toggleLanguage}
        aria-label="Chuyển đổi ngôn ngữ Tiếng Việt / Tiếng Anh"
        className={`flex items-center justify-center gap-1.5 h-8 sm:h-9 min-w-[54px] px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1c1c1e] hover:bg-slate-50 dark:hover:bg-[#2c2c2e] hover:border-slate-400 dark:hover:border-white/30 transition-all cursor-pointer select-none text-xs font-bold text-slate-800 dark:text-zinc-200 dark:hover:text-white active:scale-95 shadow-2xs ${className}`}
      >
        <GlobeIcon size={14} className="text-slate-600 dark:text-zinc-300 shrink-0" />
        <span className="uppercase font-bold tracking-wider text-[11px] sm:text-xs">
          {language.toUpperCase()}
        </span>
      </button>
    </Tooltip>
  );
};

