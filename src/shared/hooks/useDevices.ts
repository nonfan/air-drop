import { useState, useEffect, useCallback } from 'react';

export interface Device {
  id: string;
  name: string;
  model?: string;
  ip: string;
  port?: number;
  type: 'pc' | 'mobile';
}

/**
 * 设备管理 Hook
 */
export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  /**
   * 添加设备
   */
  const addDevice = useCallback((device: Device) => {
    setDevices(prev => {
      const exists = prev.find(d => d.id === device.id);
      if (exists) {
        return prev.map(d => d.id === device.id ? device : d);
      }
      return [...prev, device];
    });
  }, []);

  /**
   * 移除设备
   */
  const removeDevice = useCallback((deviceId: string) => {
    setDevices(prev => prev.filter(d => d.id !== deviceId));
    setSelectedDevice(prev => prev === deviceId ? null : prev);
  }, []);

  /**
   * 更新设备
   */
  const updateDevice = useCallback((deviceId: string, updates: Partial<Device>) => {
    setDevices(prev => prev.map(d => 
      d.id === deviceId ? { ...d, ...updates } : d
    ));
  }, []);

  /**
   * 清空设备列表
   */
  const clearDevices = useCallback(() => {
    setDevices([]);
    setSelectedDevice(null);
  }, []);

  /**
   * 根据类型过滤设备
   */
  const getDevicesByType = useCallback((type: 'pc' | 'mobile') => {
    return devices.filter(d => d.type === type);
  }, [devices]);

  /**
   * 获取选中的设备
   */
  const selectedDeviceData = devices.find(d => d.id === selectedDevice) || null;

  return {
    devices,
    selectedDevice,
    selectedDeviceData,
    setSelectedDevice,
    addDevice,
    removeDevice,
    updateDevice,
    clearDevices,
    getDevicesByType
  };
}
