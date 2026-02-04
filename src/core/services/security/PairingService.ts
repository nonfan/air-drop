/**
 * 设备配对服务
 * 处理设备间的配对、公钥交换和信任管理
 */

export interface PairingCode {
  code: string;        // 6位数字
  expiresAt: number;   // 过期时间（5分钟）
  deviceId: string;    // 设备ID
  publicKey: string;   // 公钥
}

export interface TrustedDevice {
  deviceId: string;
  deviceName: string;
  publicKey: string;
  pairedAt: number;
  lastSeen?: number;
}

export class PairingService {
  private activePairings: Map<string, PairingCode> = new Map();
  private trustedDevices: Map<string, TrustedDevice> = new Map();
  private readonly PAIRING_TIMEOUT = 5 * 60 * 1000; // 5分钟
  private readonly MAX_ATTEMPTS = 3;
  private attemptCounts: Map<string, number> = new Map();

  /**
   * 生成配对码
   */
  generatePairingCode(deviceId: string, publicKey: string): PairingCode {
    // 生成随机6位数字
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    const pairingCode: PairingCode = {
      code,
      expiresAt: Date.now() + this.PAIRING_TIMEOUT,
      deviceId,
      publicKey
    };
    
    // 保存配对码
    this.activePairings.set(deviceId, pairingCode);
    
    // 重置尝试次数
    this.attemptCounts.set(deviceId, 0);
    
    // 设置自动清理
    setTimeout(() => {
      this.activePairings.delete(deviceId);
      this.attemptCounts.delete(deviceId);
    }, this.PAIRING_TIMEOUT);
    
    return pairingCode;
  }

  /**
   * 验证配对码
   */
  async verifyPairingCode(
    code: string,
    remoteDeviceId: string,
    remoteDeviceName: string
  ): Promise<{ success: boolean; publicKey?: string; reason?: string }> {
    // 检查配对码是否存在
    const pairing = this.activePairings.get(remoteDeviceId);
    if (!pairing) {
      return { success: false, reason: 'pairing_not_found' };
    }
    
    // 检查是否过期
    if (Date.now() > pairing.expiresAt) {
      this.activePairings.delete(remoteDeviceId);
      this.attemptCounts.delete(remoteDeviceId);
      return { success: false, reason: 'pairing_expired' };
    }
    
    // 检查尝试次数
    const attempts = this.attemptCounts.get(remoteDeviceId) || 0;
    if (attempts >= this.MAX_ATTEMPTS) {
      this.activePairings.delete(remoteDeviceId);
      this.attemptCounts.delete(remoteDeviceId);
      return { success: false, reason: 'too_many_attempts' };
    }
    
    // 验证配对码
    if (pairing.code !== code) {
      this.attemptCounts.set(remoteDeviceId, attempts + 1);
      return { success: false, reason: 'invalid_code' };
    }
    
    // 配对成功，保存受信任设备
    await this.saveTrustedDevice(remoteDeviceId, remoteDeviceName, pairing.publicKey);
    
    // 清理配对数据
    this.activePairings.delete(remoteDeviceId);
    this.attemptCounts.delete(remoteDeviceId);
    
    return { success: true, publicKey: pairing.publicKey };
  }

  /**
   * 保存受信任设备
   */
  async saveTrustedDevice(
    deviceId: string,
    deviceName: string,
    publicKey: string
  ): Promise<void> {
    const device: TrustedDevice = {
      deviceId,
      deviceName,
      publicKey,
      pairedAt: Date.now(),
      lastSeen: Date.now()
    };
    
    this.trustedDevices.set(deviceId, device);
    
    // TODO: 持久化到 IndexedDB
  }

  /**
   * 获取受信任设备
   */
  getTrustedDevice(deviceId: string): TrustedDevice | null {
    return this.trustedDevices.get(deviceId) || null;
  }

  /**
   * 获取所有受信任设备
   */
  getTrustedDevices(): TrustedDevice[] {
    return Array.from(this.trustedDevices.values());
  }

  /**
   * 检查设备是否受信任
   */
  isTrustedDevice(deviceId: string): boolean {
    return this.trustedDevices.has(deviceId);
  }

  /**
   * 移除受信任设备
   */
  async removeTrustedDevice(deviceId: string): Promise<boolean> {
    const existed = this.trustedDevices.has(deviceId);
    this.trustedDevices.delete(deviceId);
    
    // TODO: 从 IndexedDB 删除
    
    return existed;
  }

  /**
   * 更新设备最后见到时间
   */
  updateLastSeen(deviceId: string): void {
    const device = this.trustedDevices.get(deviceId);
    if (device) {
      device.lastSeen = Date.now();
    }
  }

  /**
   * 取消配对
   */
  cancelPairing(deviceId: string): void {
    this.activePairings.delete(deviceId);
    this.attemptCounts.delete(deviceId);
  }

  /**
   * 获取活动配对
   */
  getActivePairing(deviceId: string): PairingCode | null {
    const pairing = this.activePairings.get(deviceId);
    
    // 检查是否过期
    if (pairing && Date.now() > pairing.expiresAt) {
      this.activePairings.delete(deviceId);
      this.attemptCounts.delete(deviceId);
      return null;
    }
    
    return pairing || null;
  }

  /**
   * 获取配对剩余时间（秒）
   */
  getPairingTimeRemaining(deviceId: string): number {
    const pairing = this.activePairings.get(deviceId);
    if (!pairing) return 0;
    
    const remaining = Math.max(0, pairing.expiresAt - Date.now());
    return Math.floor(remaining / 1000);
  }

  /**
   * 清理所有过期的配对
   */
  cleanupExpiredPairings(): void {
    const now = Date.now();
    for (const [deviceId, pairing] of this.activePairings.entries()) {
      if (now > pairing.expiresAt) {
        this.activePairings.delete(deviceId);
        this.attemptCounts.delete(deviceId);
      }
    }
  }

  /**
   * 获取配对统计
   */
  getPairingStats(): {
    activePairings: number;
    trustedDevices: number;
  } {
    this.cleanupExpiredPairings();
    
    return {
      activePairings: this.activePairings.size,
      trustedDevices: this.trustedDevices.size
    };
  }
}
