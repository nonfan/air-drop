/**
 * 安全服务 Hook
 * 提供安全服务的 React Hook 接口
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getSecurityService,
  SecurityServiceAdapter,
  TrustedDevice,
  DevicePermissions,
  SecuritySettings
} from '../services/SecurityServiceAdapter';
import { Permission } from '../../shared/components';

interface UseSecurityServiceResult {
  // 状态
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  
  // 安全设置
  settings: SecuritySettings;
  updateSettings: (settings: Partial<SecuritySettings>) => void;
  
  // 设备管理
  devices: TrustedDevice[];
  refreshDevices: () => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  isTrustedDevice: (deviceId: string) => Promise<boolean>;
  
  // 配对
  generatePairingCode: (targetDeviceId: string) => Promise<string>;
  verifyPairingCode: (targetDeviceId: string, code: string, targetDeviceName: string) => Promise<boolean>;
  
  // 权限管理
  getDevicePermissions: (deviceId: string) => DevicePermissions | null;
  grantPermissions: (deviceId: string, permissions: Permission[], expiresAt?: number) => Promise<void>;
  revokePermissions: (deviceId: string, permissions: Permission[]) => Promise<void>;
  hasPermission: (deviceId: string, permission: Permission) => Promise<boolean>;
  
  // 加密
  encryptFile: (file: File) => Promise<Blob>;
  decryptFile: (encryptedBlob: Blob, sessionKey: import('../../core/services/security/CryptoService').SessionKey) => Promise<Blob>;
  
  // 完整性
  calculateFileHash: (file: File) => Promise<string>;
  verifyFileIntegrity: (file: File, expectedHash: string) => Promise<boolean>;
  
  // 初始化
  initialize: (password: string) => Promise<void>;
}

const STORAGE_KEY_SETTINGS = 'securitySettings';
const DEFAULT_PASSWORD = 'default-password'; // 生产环境应该让用户设置

/**
 * 使用安全服务的 Hook
 */
export function useSecurityService(deviceId: string): UseSecurityServiceResult {
  const [service] = useState<SecurityServiceAdapter>(() => getSecurityService(deviceId));
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [settings, setSettings] = useState<SecuritySettings>(() => {
    // 从 localStorage 加载设置
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // 忽略解析错误
      }
    }
    return {
      requirePairing: true,
      encryptTransfers: true,
      verifyIntegrity: true
    };
  });

  // 初始化服务
  const initialize = useCallback(async (password: string) => {
    if (isInitialized) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await service.initialize(password);
      setIsInitialized(true);
      
      // 加载设备列表
      const deviceList = service.getTrustedDevices();
      setDevices(deviceList);
    } catch (err) {
      const message = err instanceof Error ? err.message : '初始化失败';
      setError(message);
      console.error('[useSecurityService] 初始化失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [service, isInitialized]);

  // 自动初始化（只执行一次）
  useEffect(() => {
    if (!isInitialized && !isLoading && !error) {
      initialize(DEFAULT_PASSWORD).catch(console.error);
    }
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 更新设置
  const updateSettings = useCallback((newSettings: Partial<SecuritySettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
  }, [settings]);

  // 刷新设备列表
  const refreshDevices = useCallback(async () => {
    if (!isInitialized) {
      return;
    }

    try {
      const deviceList = service.getTrustedDevices();
      setDevices(deviceList);
    } catch (err) {
      console.error('[useSecurityService] 刷新设备列表失败:', err);
    }
  }, [service, isInitialized]);

  // 移除设备
  const removeDevice = useCallback(async (deviceId: string) => {
    if (!isInitialized) {
      throw new Error('服务未初始化');
    }

    setIsLoading(true);
    setError(null);

    try {
      await service.removeTrustedDevice(deviceId);
      await refreshDevices();
    } catch (err) {
      const message = err instanceof Error ? err.message : '移除设备失败';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [service, isInitialized, refreshDevices]);

  // 检查设备是否受信任
  const isTrustedDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    if (!isInitialized) {
      return false;
    }

    try {
      return service.isTrustedDevice(deviceId);
    } catch (err) {
      console.error('[useSecurityService] 检查设备失败:', err);
      return false;
    }
  }, [service, isInitialized]);

  // 生成配对码
  const generatePairingCode = useCallback(async (targetDeviceId: string): Promise<string> => {
    if (!isInitialized) {
      throw new Error('服务未初始化');
    }

    setIsLoading(true);
    setError(null);

    try {
      const code = await service.generatePairingCode(targetDeviceId);
      return code;
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成配对码失败';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [service, isInitialized]);

  // 验证配对码
  const verifyPairingCode = useCallback(async (
    targetDeviceId: string,
    code: string,
    targetDeviceName: string
  ): Promise<boolean> => {
    if (!isInitialized) {
      throw new Error('服务未初始化');
    }

    setIsLoading(true);
    setError(null);

    try {
      const isValid = await service.verifyPairingCode(targetDeviceId, code, targetDeviceName);
      
      if (isValid) {
        await refreshDevices();
      }
      
      return isValid;
    } catch (err) {
      const message = err instanceof Error ? err.message : '验证配对码失败';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [service, isInitialized, refreshDevices]);

  // 获取设备权限
  const getDevicePermissions = useCallback((deviceId: string): DevicePermissions | null => {
    if (!isInitialized) {
      return null;
    }

    try {
      return service.getDevicePermissions(deviceId);
    } catch (err) {
      console.error('[useSecurityService] 获取权限失败:', err);
      return null;
    }
  }, [service, isInitialized]);

  // 授予权限
  const grantPermissions = useCallback(async (
    deviceId: string,
    permissions: Permission[],
    expiresAt?: number
  ): Promise<void> => {
    if (!isInitialized) {
      throw new Error('服务未初始化');
    }

    setIsLoading(true);
    setError(null);

    try {
      service.grantPermissions(deviceId, permissions, expiresAt);
    } catch (err) {
      const message = err instanceof Error ? err.message : '授予权限失败';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [service, isInitialized]);

  // 撤销权限
  const revokePermissions = useCallback(async (
    deviceId: string,
    permissions: Permission[]
  ): Promise<void> => {
    if (!isInitialized) {
      throw new Error('服务未初始化');
    }

    setIsLoading(true);
    setError(null);

    try {
      service.revokePermissions(deviceId, permissions);
    } catch (err) {
      const message = err instanceof Error ? err.message : '撤销权限失败';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [service, isInitialized]);

  // 检查权限
  const hasPermission = useCallback(async (
    deviceId: string,
    permission: Permission
  ): Promise<boolean> => {
    if (!isInitialized) {
      return false;
    }

    try {
      return service.hasPermission(deviceId, permission);
    } catch (err) {
      console.error('[useSecurityService] 检查权限失败:', err);
      return false;
    }
  }, [service, isInitialized]);

  // 加密文件
  const encryptFile = useCallback(async (file: File): Promise<Blob> => {
    if (!isInitialized) {
      throw new Error('服务未初始化');
    }

    setIsLoading(true);
    setError(null);

    try {
      return await service.encryptFile(file);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加密文件失败';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [service, isInitialized]);

  // 解密文件
  const decryptFile = useCallback(async (
    encryptedBlob: Blob,
    sessionKey: import('../../core/services/security/CryptoService').SessionKey
  ): Promise<Blob> => {
    if (!isInitialized) {
      throw new Error('服务未初始化');
    }

    setIsLoading(true);
    setError(null);

    try {
      return await service.decryptFile(encryptedBlob, sessionKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : '解密文件失败';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [service, isInitialized]);

  // 计算文件哈希
  const calculateFileHash = useCallback(async (file: File): Promise<string> => {
    if (!isInitialized) {
      throw new Error('服务未初始化');
    }

    setIsLoading(true);
    setError(null);

    try {
      return await service.calculateFileHash(file);
    } catch (err) {
      const message = err instanceof Error ? err.message : '计算哈希失败';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [service, isInitialized]);

  // 验证文件完整性
  const verifyFileIntegrity = useCallback(async (
    file: File,
    expectedHash: string
  ): Promise<boolean> => {
    if (!isInitialized) {
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      return await service.verifyFileIntegrity(file, expectedHash);
    } catch (err) {
      const message = err instanceof Error ? err.message : '验证完整性失败';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [service, isInitialized]);

  return {
    // 状态
    isInitialized,
    isLoading,
    error,
    
    // 安全设置
    settings,
    updateSettings,
    
    // 设备管理
    devices,
    refreshDevices,
    removeDevice,
    isTrustedDevice,
    
    // 配对
    generatePairingCode,
    verifyPairingCode,
    
    // 权限管理
    getDevicePermissions,
    grantPermissions,
    revokePermissions,
    hasPermission,
    
    // 加密
    encryptFile,
    decryptFile,
    
    // 完整性
    calculateFileHash,
    verifyFileIntegrity,
    
    // 初始化
    initialize
  };
}
