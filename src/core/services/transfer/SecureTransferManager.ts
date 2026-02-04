/**
 * 安全传输管理器
 * 集成加密、完整性验证和访问控制的传输管理
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { CryptoService, SessionKey } from '../security/CryptoService';
import { KeyExchangeService } from '../security/KeyExchangeService';
import { IntegrityService } from '../security/IntegrityService';
import { PairingService } from '../security/PairingService';
import { AccessControlService, Permission } from '../security/AccessControlService';
import { SecureStorage } from '../security/SecureStorage';

export interface SecureTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  targetId: string;
  status: 'pending' | 'active' | 'paused' | 'completed' | 'failed';
  progress: number;
  speed: number;
  startTime?: number;
  endTime?: number;
  error?: Error;
  encrypted: boolean;
  verified: boolean;
  fileHash?: string;
  signature?: string;
}

export interface SecureTransferOptions {
  chunkSize?: number;
  maxConcurrent?: number;
  encrypt?: boolean;
  verify?: boolean;
  onProgress?: (progress: number) => void;
}

export class SecureTransferManager extends EventEmitter {
  private transfers: Map<string, SecureTransfer> = new Map();
  private activeTransfers: Set<string> = new Set();
  private maxConcurrent: number = 3;

  private cryptoService: CryptoService;
  private keyExchangeService: KeyExchangeService;
  private integrityService: IntegrityService;
  private pairingService: PairingService;
  private accessControlService: AccessControlService;
  private secureStorage: SecureStorage;

  constructor() {
    super();
    this.cryptoService = new CryptoService();
    this.keyExchangeService = new KeyExchangeService();
    this.integrityService = new IntegrityService();
    this.pairingService = new PairingService();
    this.accessControlService = new AccessControlService();
    this.secureStorage = new SecureStorage();
  }

  /**
   * 创建安全传输
   */
  async createSecureTransfer(
    file: File,
    targetId: string,
    options?: SecureTransferOptions
  ): Promise<SecureTransfer> {
    // 检查设备是否受信任
    if (!this.pairingService.isTrustedDevice(targetId)) {
      throw new Error('Target device is not trusted. Please pair first.');
    }

    // 检查写入权限
    if (!this.accessControlService.hasPermission(targetId, Permission.WRITE)) {
      throw new Error('No permission to send files to this device');
    }

    const transfer: SecureTransfer = {
      id: uuidv4(),
      fileName: file.name,
      fileSize: file.size,
      targetId,
      status: 'pending',
      progress: 0,
      speed: 0,
      encrypted: options?.encrypt ?? true,
      verified: options?.verify ?? true
    };

    // 如果需要验证，计算文件哈希
    if (transfer.verified) {
      this.emit('transfer-hashing', transfer);
      transfer.fileHash = await this.integrityService.calculateFileHash(file);
    }

    this.transfers.set(transfer.id, transfer);
    this.emit('transfer-created', transfer);

    return transfer;
  }

  /**
   * 开始传输
   */
  async start(transferId: string, file: File): Promise<void> {
    const transfer = this.transfers.get(transferId);
    if (!transfer) {
      throw new Error(`Transfer ${transferId} not found`);
    }

    if (this.activeTransfers.size >= this.maxConcurrent) {
      throw new Error('Max concurrent transfers reached');
    }

    transfer.status = 'active';
    transfer.startTime = Date.now();
    this.activeTransfers.add(transferId);

    this.emit('transfer-started', transfer);

    try {
      await this.executeSecureTransfer(transfer, file);
      transfer.status = 'completed';
      transfer.endTime = Date.now();
      this.emit('transfer-completed', transfer);
    } catch (error) {
      transfer.status = 'failed';
      transfer.error = error as Error;
      this.emit('transfer-failed', transfer);
      throw error;
    } finally {
      this.activeTransfers.delete(transferId);
    }
  }

  /**
   * 接收安全传输
   */
  async receiveSecureTransfer(
    transferId: string,
    encryptedData: Blob,
    metadata: {
      fileName: string;
      fileSize: number;
      senderId: string;
      encrypted: boolean;
      verified: boolean;
      fileHash?: string;
      signature?: string;
    }
  ): Promise<File> {
    // 检查设备是否受信任
    if (!this.pairingService.isTrustedDevice(metadata.senderId)) {
      throw new Error('Sender device is not trusted');
    }

    // 检查读取权限
    if (!this.accessControlService.hasPermission(metadata.senderId, Permission.READ)) {
      throw new Error('No permission to receive files from this device');
    }

    let fileData = encryptedData;

    // 解密文件
    if (metadata.encrypted) {
      this.emit('transfer-decrypting', { transferId });
      
      const sessionKey = await this.secureStorage.retrieveSessionKey(metadata.senderId);
      if (!sessionKey) {
        throw new Error('Session key not found for sender');
      }

      fileData = await this.cryptoService.decryptFile(encryptedData, sessionKey);
    }

    // 创建文件对象
    const file = new File([fileData], metadata.fileName, { type: 'application/octet-stream' });

    // 验证完整性
    if (metadata.verified && metadata.fileHash) {
      this.emit('transfer-verifying', { transferId });
      
      const isValid = await this.integrityService.verifyFileIntegrity(file, metadata.fileHash);
      if (!isValid) {
        throw new Error('File integrity verification failed');
      }

      // 验证签名（如果有）
      if (metadata.signature) {
        const trustedDevice = this.pairingService.getTrustedDevice(metadata.senderId);
        if (trustedDevice) {
          const fileBuffer = await file.arrayBuffer();
          const signatureValid = await this.integrityService.verifySignature(
            fileBuffer,
            metadata.signature,
            trustedDevice.publicKey
          );
          
          if (!signatureValid) {
            throw new Error('File signature verification failed');
          }
        }
      }
    }

    this.emit('transfer-received', { transferId, file });
    return file;
  }

  /**
   * 暂停传输
   */
  pause(transferId: string): void {
    const transfer = this.transfers.get(transferId);
    if (transfer && transfer.status === 'active') {
      transfer.status = 'paused';
      this.activeTransfers.delete(transferId);
      this.emit('transfer-paused', transfer);
    }
  }

  /**
   * 恢复传输
   */
  resume(transferId: string, file: File): void {
    const transfer = this.transfers.get(transferId);
    if (transfer && transfer.status === 'paused') {
      this.start(transferId, file);
    }
  }

  /**
   * 取消传输
   */
  cancel(transferId: string): void {
    const transfer = this.transfers.get(transferId);
    if (transfer) {
      transfer.status = 'failed';
      transfer.error = new Error('Transfer cancelled');
      this.activeTransfers.delete(transferId);
      this.emit('transfer-cancelled', transfer);
    }
  }

  /**
   * 获取传输信息
   */
  getTransfer(id: string): SecureTransfer | null {
    return this.transfers.get(id) || null;
  }

  /**
   * 获取所有传输
   */
  getAllTransfers(): SecureTransfer[] {
    return Array.from(this.transfers.values());
  }

  /**
   * 获取活动传输
   */
  getActiveTransfers(): SecureTransfer[] {
    return Array.from(this.activeTransfers)
      .map(id => this.transfers.get(id))
      .filter((t): t is SecureTransfer => t !== undefined);
  }

  /**
   * 配对设备
   */
  async pairDevice(deviceId: string, deviceName: string, publicKey: string): Promise<string> {
    const pairingCode = this.pairingService.generatePairingCode(deviceId, publicKey);
    
    // 授予默认权限
    this.accessControlService.grantDefaultPermissions(deviceId);
    
    this.emit('device-pairing-started', { deviceId, code: pairingCode.code });
    
    return pairingCode.code;
  }

  /**
   * 验证配对
   */
  async verifyPairing(code: string, remoteDeviceId: string, remoteDeviceName: string): Promise<boolean> {
    const result = await this.pairingService.verifyPairingCode(code, remoteDeviceId, remoteDeviceName);
    
    if (result.success) {
      // 授予默认权限
      this.accessControlService.grantDefaultPermissions(remoteDeviceId);
      
      this.emit('device-paired', { deviceId: remoteDeviceId });
    } else {
      this.emit('device-pairing-failed', { deviceId: remoteDeviceId, reason: result.reason });
    }
    
    return result.success;
  }

  /**
   * 建立安全会话
   */
  async establishSecureSession(deviceId: string): Promise<void> {
    const trustedDevice = this.pairingService.getTrustedDevice(deviceId);
    if (!trustedDevice) {
      throw new Error('Device is not trusted');
    }

    // 生成会话密钥
    const sessionKey = await this.cryptoService.generateSessionKey();
    
    // 存储会话密钥
    await this.secureStorage.storeSessionKey(deviceId, sessionKey);
    
    // 加密会话密钥用于传输
    const encryptedKey = await this.keyExchangeService.encryptSessionKey(
      sessionKey,
      trustedDevice.publicKey
    );
    
    const encryptedIV = await this.keyExchangeService.encryptSessionIV(
      sessionKey.iv,
      trustedDevice.publicKey
    );
    
    this.emit('session-established', {
      deviceId,
      encryptedKey,
      encryptedIV
    });
  }

  /**
   * 接收会话密钥
   */
  async receiveSessionKey(
    deviceId: string,
    encryptedKey: string,
    encryptedIV: string,
    privateKey: string
  ): Promise<void> {
    // 解密会话密钥
    const key = await this.keyExchangeService.decryptSessionKey(encryptedKey, privateKey);
    const iv = await this.keyExchangeService.decryptSessionIV(encryptedIV, privateKey);
    
    const sessionKey: SessionKey = {
      key,
      iv,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24小时
    };
    
    // 存储会话密钥
    await this.secureStorage.storeSessionKey(deviceId, sessionKey);
    
    this.emit('session-received', { deviceId });
  }

  /**
   * 执行安全传输
   */
  private async executeSecureTransfer(transfer: SecureTransfer, file: File): Promise<void> {
    let fileToSend: Blob = file;

    // 加密文件
    if (transfer.encrypted) {
      this.emit('transfer-encrypting', transfer);
      
      const sessionKey = await this.secureStorage.retrieveSessionKey(transfer.targetId);
      if (!sessionKey) {
        throw new Error('Session key not found. Please establish secure session first.');
      }

      fileToSend = await this.cryptoService.encryptFile(file, sessionKey);
    }

    // 生成签名
    if (transfer.verified && this.secureStorage.hasPrivateKey()) {
      this.emit('transfer-signing', transfer);
      
      const fileBuffer = await file.arrayBuffer();
      const privateKey = await this.secureStorage.retrievePrivateKey(''); // 需要密码
      transfer.signature = await this.integrityService.signData(fileBuffer, privateKey);
    }

    // TODO: 实际传输逻辑
    // 这里应该调用底层传输服务（HTTP/WebSocket）
    this.emit('transfer-uploading', transfer);
    
    // 模拟传输进度
    for (let i = 0; i <= 100; i += 10) {
      transfer.progress = i;
      this.emit('transfer-progress', transfer);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * 获取受信任设备列表
   */
  getTrustedDevices() {
    return this.pairingService.getTrustedDevices();
  }

  /**
   * 移除受信任设备
   */
  async removeTrustedDevice(deviceId: string): Promise<void> {
    await this.pairingService.removeTrustedDevice(deviceId);
    this.accessControlService.revokePermission(deviceId);
    await this.secureStorage.removeSessionKey(deviceId);
    
    this.emit('device-removed', { deviceId });
  }

  /**
   * 获取设备权限
   */
  getDevicePermissions(deviceId: string) {
    return this.accessControlService.getDevicePermissions(deviceId);
  }

  /**
   * 授予权限
   */
  grantPermission(deviceId: string, permission: Permission): void {
    this.accessControlService.grantPermission(deviceId, permission);
    this.emit('permission-granted', { deviceId, permission });
  }

  /**
   * 撤销权限
   */
  revokePermission(deviceId: string, permission?: Permission): void {
    this.accessControlService.revokePermission(deviceId, permission);
    this.emit('permission-revoked', { deviceId, permission });
  }
}
