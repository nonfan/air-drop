/**
 * 主题相关工具函数
 */

// 主题色映射
export const ACCENT_COLOR_MAP: Record<string, string> = {
  blue: '#3b82f6',
  green: '#22c55e',
  purple: '#a855f7',
  pink: '#ec4899',
  orange: '#f97316'
};

// Hover 颜色映射
export const ACCENT_HOVER_MAP: Record<string, string> = {
  blue: '#2563eb',
  green: '#16a34a',
  purple: '#9333ea',
  pink: '#db2777',
  orange: '#ea580c'
};

// 背景颜色映射（15% 透明度）
export const ACCENT_BG_MAP: Record<string, string> = {
  blue: 'rgba(59, 130, 246, 0.15)',
  green: 'rgba(34, 197, 94, 0.15)',
  purple: 'rgba(168, 85, 247, 0.15)',
  pink: 'rgba(236, 72, 153, 0.15)',
  orange: 'rgba(249, 115, 22, 0.15)'
};

/**
 * 应用主题模式（深色/浅色/系统）
 * @param theme 主题模式
 */
export function applyThemeMode(theme: 'system' | 'dark' | 'light'): void {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
    root.classList.toggle('light', !prefersDark);
  } else {
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
  }
}

/**
 * 应用主题色
 * @param accentColor 主题色名称
 */
export function applyAccentColor(accentColor: string): void {
  const color = ACCENT_COLOR_MAP[accentColor] || ACCENT_COLOR_MAP.blue;
  const hoverColor = ACCENT_HOVER_MAP[accentColor] || ACCENT_HOVER_MAP.blue;
  const accentBg = ACCENT_BG_MAP[accentColor] || ACCENT_BG_MAP.blue;

  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-hover', hoverColor);
  document.documentElement.style.setProperty('--accent-bg', accentBg);
}
