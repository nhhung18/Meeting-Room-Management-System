import { useState, useEffect } from 'react';

export interface Breakpoints {
  isMobile: boolean;  // < 768px
  isTablet: boolean;  // 768px - 1024px
  isDesktop: boolean; // > 1024px
  width: number;
}

export const useBreakpoint = (): Breakpoints => {
  const [width, setWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    width,
  };
};
