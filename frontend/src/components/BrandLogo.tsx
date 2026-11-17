import React from 'react';
import { useTheme } from '../context/ThemeContext';

export interface BrandLogoProps {
  variant?: 'full' | 'icon';
  className?: string;
  alt?: string;
}

/**
 * Renders the theme-aware MRMS brand wordmark or standalone M icon mark.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'full',
  className = '',
  alt = 'MRMS Logo',
}) => {
  const { isDark } = useTheme();

  const src =
    variant === 'icon'
      ? '/assets/aistudio/mrms-icon.png'
      : isDark
      ? '/assets/aistudio/mrms-logo-dark.png'
      : '/assets/aistudio/mrms-logo.png';

  return <img src={src} alt={alt} className={`object-contain shrink-0 ${className}`} />;
};
