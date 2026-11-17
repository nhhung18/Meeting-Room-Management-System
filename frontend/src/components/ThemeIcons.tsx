import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

/**
 * Biểu tượng Mặt trời (Brightness / Light Mode)
 * Thiết kế chuẩn Apple HIG Vector SVG
 * Lõi tròn solid kết hợp 8 tia sáng dạng viên nang bo tròn sắc nét đối xứng
 */
export const BrightnessIcon: React.FC<IconProps> = ({ className = '', size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Vòng tròn tâm solid */}
    <circle cx="12" cy="12" r="4.25" fill="currentColor" />
    {/* 4 tia thẳng */}
    <line x1="12" y1="2" x2="12" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="2" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="19" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    {/* 4 tia chéo 45 độ */}
    <line x1="4.93" y1="4.93" x2="7.05" y2="7.05" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="4.93" y1="19.07" x2="7.05" y2="16.95" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="16.95" y1="7.05" x2="19.07" y2="4.93" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/**
 * Biểu tượng Mặt trăng (Moon / Dark Mode)
 * Chuẩn Apple HIG moon.fill solid crescent vector
 */
export const MoonIcon: React.FC<IconProps> = ({ className = '', size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M21.64 13a1 1 0 0 0-1.05-.14A8.049 8.049 0 0 1 11.14 3.41a1 1 0 0 0-.91-.79 1 1 0 0 0-.91.51A9.993 9.993 0 0 0 12 22a10.02 10.02 0 0 0 9.77-7.79 1 1 0 0 0-.13-1.21z"
    />
  </svg>
);

/**
 * Biểu tượng Quả địa cầu / Ngôn ngữ (Globe / Language)
 * Vector sắc nét chuẩn Apple HIG
 */
export const GlobeIcon: React.FC<IconProps> = ({ className = '', size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
