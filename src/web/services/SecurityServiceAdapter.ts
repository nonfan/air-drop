/**
 * 安全服务适配器
 * 为 Web 应用提供安全服务的统一接口
 */

import { CryptoService } from '../../core/services/security/CryptoService';
import { PairingService } from '../../core/services/security/PairingService';
import { AccessControlService } from '../../core/services/security/AccessControlService';
import { SecureStorage } from '../../core/services/security/SecureStorage';
import { IntegrityService } from '../../core/services/security/IntegrityService';
import { Permission } from '../../shared/components';

// 设备信息类型
export interface TrustedDevice {
  deviceId: string;
  deviceName: string;
  publicKey: string;
  pairedAt: number;
  lastSeen?: number;
}

// 权限信息类型
export interface DevicePermissions {
  deviceId: string;
  permissions: Permission[];
  expiresAt?: number;
  grantedAt: number;
}

// 安全设置类型
export interface SecuritySettings {
  requirePairing: boolean;
  encryptTransfers: boolean;
  verifyIntegrity: boolean;
}

/**
 * 安全服务适配器类
 */
export class SecurityServiceAdapter {
  private cryptoService: CryptoService;
  private pairingService: PairingService;
  private accessControlService: AccessControlService;
  private secureStorage: SecureStorage;
  private integrityService: IntegrityService;

  private initialized = false;
  private deviceId: string;
  private keyPair: { publicKey: string; privateKey: string } | null = null;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
    this.cryptoService = new CryptoService();
    this.pairingService = new PairingService();
    this.accessControlService = new AccessControlService();
    this.secureStorage = new SecureStorage();
    this.integrityService = new IntegrityService();
  }

  /**
   * 初始化安全服务
   */
  async initialize(password: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 检查 Web Crypto API 是否可用
      if (typeof crypto === 'undefined' || !crypto.subtle) {
        throw new Error('Web Crypto API 不可用。请确保在 HTTPS 环境或 localhost 下运行。');
      }

      // 检查 localStorage 是否可用
      if (typeof localStorage === 'undefined') {
        throw new Error('localStorage 不可用。请检查浏览器设置。');
      }

      // 检查是否已有私钥
      if (this.secureStorage.hasPrivateKey()) {
        // 加载现有密钥对
        const privateKey = await this.secureStorage.retrievePrivateKey(password);
        // 从私钥恢复公钥（这里简化处理，实际应该单独存储公钥）
        const publicKey = localStorage.getItem('public_key') || '';
        if (!publicKey) {
          throw new Error('公钥丢失，请重置安全服务');
        }
        this.keyPair = { publicKey, privateKey };
      } else {
        // 首次使用，生成新密钥对
        this.keyPair = await this.cryptoService.generateKeyPair();
        await this.secureStorage.storePrivateKey(this.keyPair.privateKey, password);
        // 存储公钥（不需要加密）
        localStorage.setItem('public_key', this.keyPair.publicKey);
      }

      this.initialized = true;
      console.log('[SecurityServiceAdapter] 初始化成功');
    } catch (error) {
      console.error('[SecurityServiceAdapter] 初始化失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      throw new Error('安全服务初始化失败: ' + errorMessage);
    }
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ==================== 配对服务 ====================

  /**
   * 生成配对码
   */
  async generatePairingCode(targetDeviceId: string): Promise<string> {
    this.ensureInitialized();
    
    try {
      const publicKey = await this.getPublicKey();
      const pairingCode = this.pairingService.generatePairingCode(
        targetDeviceId,
        publicKey
      );
      
      console.log('[SecurityServiceAdapter] 配对码已生成');
      return pairingCode.code;
    } catch (error) {
      console.error('[SecurityServiceAdapter] 生成配对码失败:', error);
      throw new Error('生成配对码失败');
    }
  }

  /**
   * 验证配对码
   */
  async verifyPairingCode(
    targetDeviceId: string,
    code: string,
    targetDeviceName: string
  ): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      const result = await this.pairingService.verifyPairingCode(
        code,
        targetDeviceId,
        targetDeviceName
      );
      
      if (result.success) {
        console.log('[SecurityServiceAdapter] 配对验证成功');
      }
      
      return result.success;
    } catch (error) {
      console.error('[SecurityServiceAdapter] 验证配对码失败:', error);
      throw new Error('验证配对码失败');
    }
  }

  /**
   * 获取受信任设备列表
   */
  getTrustedDevices(): TrustedDevice[] {
    this.ensureInitialized();
    
    try {
      const devices = this.pairingService.getTrustedDevices();
      return devices.map(device => ({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        publicKey: device.publicKey,
        pairedAt: device.pairedAt,
        lastSeen: device.lastSeen
      }));
    } catch (error) {
      console.error('[SecurityServiceAdapter] 获取设备列表失败:', error);
      return [];
    }
  }

  /**
   * 移除受信任设备
   */
  async removeTrustedDevice(deviceId: string): Promise<void> {
    this.ensureInitialized();
    
    try {
      await this.pairingService.removeTrustedDevice(deviceId);
      // 同时撤销该设备的所有权限
      this.accessControlService.revokePermission(deviceId);
      
      console.log('[SecurityServiceAdapter] 设备已移除:', deviceId);
    } catch (error) {
      console.error('[SecurityServiceAdapter] 移除设备失败:', error);
      throw new Error('移除设备失败');
    }
  }

  /**
   * 检查设备是否受信任
   */
  isTrustedDevice(deviceId: string): boolean {
    this.ensureInitialized();
    
    try {
      return this.pairingService.isTrustedDevice(deviceId);
    } catch (error) {
      console.error('[SecurityServiceAdapter] 检查设备失败:', error);
      return false;
    }
  }

  // ==================== 权限服务 ====================

  /**
   * 授予权限
   */
  grantPermissions(
    deviceId: string,
    permissions: Permission[],
    expiresAt?: number
  ): void {
    this.ensureInitialized();
    
    try {
      this.accessControlService.grantPermissions(
        deviceId,
        permissions,
        expiresAt
      );
      
      console.log('[SecurityServiceAdapter] 权限已授予:', deviceId, permissions);
    } catch (error) {
      console.error('[SecurityServiceAdapter] 授予权限失败:', error);
      throw new Error('授予权限失败');
    }
  }

  /**
   * 撤销权限
   */
  revokePermissions(
    deviceId: string,
    permissions: Permission[]
  ): void {
    this.ensureInitialized();
    
    try {
      this.accessControlService.revokePermissions(deviceId, permissions);
      console.log('[SecurityServiceAdapter] 权限已撤销:', deviceId, permissions);
    } catch (error) {
      console.error('[SecurityServiceAdapter] 撤销权限失败:', error);
      throw new Error('撤销权限失败');
    }
  }

  /**
   * 获取设备权限
   */
  getDevicePermissions(deviceId: string): DevicePermissions | null {
    this.ensureInitialized();
    
    try {
      const perms = this.accessControlService.getDevicePermissions(deviceId);
      
      if (!perms) {
        return null;
      }
      
      return {
        deviceId: perms.deviceId,
        permissions: perms.permissions as Permission[],
        expiresAt: perms.expiresAt,
        grantedAt: perms.grantedAt
      };
    } catch (error) {
      console.error('[SecurityServiceAdapter] 获取权限失败:', error);
      return null;
    }
  }

  /**
   * 检查权限
   */
  hasPermission(deviceId: string, permission: Permission): boolean {
    this.ensureInitialized();
    
    try {
      return this.accessControlService.hasPermission(deviceId, permission);
    } catch (error) {
      console.error('[SecurityServiceAdapter] 检查权限失败:', error);
      return false;
    }
  }

  // ==================== 加密服务 ====================

  /**
   * 加密文件
   */
  async encryptFile(file: File): Promise<Blob> {
    this.ensureInitialized();
    
    try {
      const sessionKey = await this.cryptoService.generateSessionKey();
      const encryptedBlob = await this.cryptoService.encryptFile(file, sessionKey);
      
      console.log('[SecurityServiceAdapter] 文件已加密:', file.name);
      return encryptedBlob;
    } catch (error) {
      console.error('[SecurityServiceAdapter] 加密文件失败:', error);
      throw new Error('加密文件失败');
    }
  }

  /**
   * 解密文件
   */
  async decryptFile(
    encryptedBlob: Blob,
    sessionKey: import('../../core/services/security/CryptoService').SessionKey
  ): Promise<Blob> {
    this.ensureInitialized();
    
    try {
      const decryptedBlob = await this.cryptoService.decryptFile(
        encryptedBlob,
        sessionKey
      );
      
      console.log('[SecurityServiceAdapter] 文件已解密');
      return decryptedBlob;
    } catch (error) {
      console.error('[SecurityServiceAdapter] 解密文件失败:', error);
      throw new Error('解密文件失败');
    }
  }

  // ==================== 完整性服务 ====================

  /**
   * 计算文件哈希
   */
  async calculateFileHash(file: File): Promise<string> {
    this.ensureInitialized();
    
    try {
      const hash = await this.integrityService.calculateFileHash(file);
      
      console.log('[SecurityServiceAdapter] 文件哈希已计算:', file.name);
      return hash;
    } catch (error) {
      console.error('[SecurityServiceAdapter] 计算哈希失败:', error);
      throw new Error('计算哈希失败');
    }
  }

  /**
   * 验证文件完整性
   */
  async verifyFileIntegrity(file: File, expectedHash: string): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      const isValid = await this.integrityService.verifyFileIntegrity(
        file,
        expectedHash
      );
      
      console.log('[SecurityServiceAdapter] 文件完整性验证:', isValid);
      return isValid;
    } catch (error) {
      console.error('[SecurityServiceAdapter] 验证完整性失败:', error);
      return false;
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取公钥
   */
  private async getPublicKey(): Promise<string> {
    if (!this.keyPair) {
      throw new Error('密钥对未初始化');
    }
    return this.keyPair.publicKey;
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('安全服务未初始化，请先调用 initialize()');
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    // 清理过期的会话密钥
    await this.secureStorage.cleanupExpiredSessionKeys();
    this.initialized = false;
    console.log('[SecurityServiceAdapter] 资源已清理');
  }
}

// 创建单例实例
let securityServiceInstance: SecurityServiceAdapter | null = null;

/**
 * 获取安全服务实例
 */
export function getSecurityService(deviceId: string): SecurityServiceAdapter {
  if (!securityServiceInstance) {
    securityServiceInstance = new SecurityServiceAdapter(deviceId);
  }
  return securityServiceInstance;
}

/**
 * 重置安全服务实例（用于测试）
 */
export function resetSecurityService(): void {
  securityServiceInstance = null;
}
