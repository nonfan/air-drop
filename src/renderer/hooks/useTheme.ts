// 主题管理 Hook
import { useEffect } from 'react';

export function useTheme(theme: 'system' | 'dark' | 'light' | undefined) {
  useEffect(() => {
    if (!theme) return;
    
    document.documentElement.setAttribute('data-theme-setting', theme);
    
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        const currentTheme = document.documentElement.getAttribute('data-theme-setting');
        if (currentTheme === 'system') {
          document.documentElement.setAttribute('data-theme', mediaQuery.matches ? 'dark' : 'light');
        }
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);
}
