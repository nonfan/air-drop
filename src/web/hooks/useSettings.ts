/**
 * 设置管理 Hook
 * 注意：设备名称的初始化在 App.tsx 中完成，这里只负责读取和更新
 */
import { useState, useCallback, useEffect } from 'react';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
  applyThemeMode,
  applyAccentColor,
  requestNotificationPermission
} from '../utils';
import type { Settings } from '../types';

// 默认设置（不包含 deviceName，由 App.tsx 初始化）
const DEFAULT_SETTINGS: Omit<Settings, 'deviceName'> = {
  theme: 'dark',
  showNotifications: false,
  discoverable: true,
  accentColor: 'blue'
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  // 初始化设置
  useEffect(() => {
    const savedSettings = getStorageItem<Settings>(STORAGE_KEYS.SETTINGS, null);
    if (savedSettings) {
      setSettings(savedSettings);
    }
  }, []);

  // 应用主题
  useEffect(() => {
    if (settings?.theme) {
      applyThemeMode(settings.theme);
    }
  }, [settings?.theme]);

  // 应用主题色
  useEffect(() => {
    if (settings?.accentColor) {
      applyAccentColor(settings.accentColor);
    }
  }, [settings?.accentColor]);

  // 请求通知权限
  useEffect(() => {
    if (settings?.showNotifications) {
      requestNotificationPermission();
    }
  }, [settings?.showNotifications]);

  // 保存设置
  const saveSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettings(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...newSettings };
      setStorageItem(STORAGE_KEYS.SETTINGS, updated);
      return updated;
    });
  }, []);

  // 初始化设置（由 App.tsx 调用）
  const initializeSettings = useCallback((deviceName: string) => {
    const savedSettings = getStorageItem<Settings>(STORAGE_KEYS.SETTINGS, null);
    
    if (savedSettings) {
      // 如果有保存的设置，使用保存的设备名称
      setSettings(savedSettings);
    } else {
      // 首次使用，创建默认设置
      const initialSettings: Settings = {
        ...DEFAULT_SETTINGS,
        deviceName
      };
      setStorageItem(STORAGE_KEYS.SETTINGS, initialSettings);
      setSettings(initialSettings);
    }
  }, []);

  return {
    settings,
    saveSettings,
    initializeSettings
  };
}
