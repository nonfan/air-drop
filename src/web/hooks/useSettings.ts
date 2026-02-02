/**
 * 设置管理 Hook
 */
import { useState, useCallback, useEffect } from 'react';
import {
  generateDeviceName,
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
  applyThemeMode,
  applyAccentColor,
  requestNotificationPermission
} from '../utils';
import type { Settings } from '../types';

const DEFAULT_SETTINGS: Settings = {
  deviceName: generateDeviceName(),
  theme: 'dark',
  showNotifications: false,
  discoverable: true,
  accentColor: 'blue'
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => {
    return getStorageItem(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  });

  // 应用主题
  useEffect(() => {
    applyThemeMode(settings.theme);
  }, [settings.theme]);

  // 应用主题色
  useEffect(() => {
    applyAccentColor(settings.accentColor);
  }, [settings.accentColor]);

  // 请求通知权限
  useEffect(() => {
    if (settings.showNotifications) {
      requestNotificationPermission();
    }
  }, [settings.showNotifications]);

  // 保存设置
  const saveSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      setStorageItem(STORAGE_KEYS.SETTINGS, updated);
      return updated;
    });
  }, []);

  return {
    settings,
    saveSettings
  };
}
