/**
 * 服务适配器 - 将新架构集成到 Electron 主进程
 * 兼容旧服务接口，提供平滑迁移
 */
import { BrowserWindow } from 'electron';
import { DiscoveryService } from '../../core/services/discovery/DiscoveryService';
import { TransferManager, Transfer } from '../../core/services/transfer/TransferManager';
import { ResumeManager } from '../../core/services/transfer/ResumeManager';
import { Device } from '../../core/types/device';
import { TransferServer } from '../../main/services/transferServer';
import { TransferClient } from '../../main/services/transferClient';

/**
 * 服务适配器 - 桥接新旧架构
 */
export class ServiceAdapter {
  private discovery: DiscoveryService | null = null;
  private transferManager: TransferManager | null = null;
  private resumeManager: ResumeManager | null = null;
  private transferServer: TransferServer | null = null;
  private transferClient: TransferClient | null = null;
  private mainWindow: BrowserWindow | null = null;
  private deviceName: string;
  private port: number;
  private downloadPath: string;

  constructor(mainWindow: BrowserWindow, deviceName: string, port: number, downloadPath: string) {
    this.mainWindow = mainWindow;
    this.deviceName = deviceName;
    this.port = port;
    this.downloadPath = downloadPath;
  }

  /**
   * 初始化所有服务
   */
  async initialize(): Promise<void> {
    console.log('[ServiceAdapter] Initializing services...');

    // 1. 初始化传输服务器
    this.transferServer = new TransferServer(this.downloadPath);
    await this.transferServer.start(this.port + 1); // 使用不同的端口
    this.setupTransferServerListeners();

    // 2. 初始化传输客户端
    this.transferClient = new TransferClient();

    // 3. 初始化传输管理器
    this.transferManager = new TransferManager();
    this.setupTransferListeners();
    
    // 设置传输处理器
    this.transferManager.setTransferHandler(async (transfer) => {
      await this.handleActualTransfer(transfer);
    });

    // 4. 初始化断点续传管理器
    // 注意：IndexedDB 在 Electron 主进程中不可用，暂时禁用
    // this.resumeManager = new ResumeManager();
    // await this.resumeManager.initialize();

    // 5. 初始化设备发现
    this.discovery = new DiscoveryService();
    await this.discovery.start();
    this.setupDiscoveryListeners();

    console.log('[ServiceAdapter] All services initialized successfully');
  }

  /**
   * 设置传输服务器事件监听
   */
  private setupTransferServerListeners(): void {
    if (!this.transferServer) return;

    this.transferServer.on('transfer-request', (request) => {
      console.log('[ServiceAdapter] Incoming transfer request:', request);
      this.mainWindow?.webContents.send('transfer-request', request);
    });

    this.transferServer.on('chunk-received', (progress) => {
      this.mainWindow?.webContents.send('transfer-progress', progress);
    });

    this.transferServer.on('transfer-complete', (result) => {
      console.log('[ServiceAdapter] Transfer completed:', result);
      this.mainWindow?.webContents.send('transfer-complete', {
        transferId: result.transferId,
        success: true,
        files: [{
          name: result.fileName,
          size: result.size,
          path: result.filePath
        }]
      });
    });

    this.transferServer.on('transfer-error', (error) => {
      console.error('[ServiceAdapter] Transfer error:', error);
      this.mainWindow?.webContents.send('transfer-complete', {
        transferId: error.transferId,
        success: false,
        error: error.error
      });
    });
  }

  /**
   * 处理实际的文件传输
   */
  private async handleActualTransfer(transfer: Transfer): Promise<void> {
    if (!this.transferClient || !this.discovery) {
      throw new Error('Transfer client or discovery not initialized');
    }

    // 获取目标设备信息
    const device = this.discovery.getDevices().find(d => d.id === transfer.targetId);
    if (!device) {
      throw new Error('Target device not found');
    }

    if (!transfer.filePath) {
      throw new Error('File path not set');
    }

    console.log(`[ServiceAdapter] Sending file to ${device.name} (${device.ip}:${this.port + 1})`);

    // 测试连接
    const connected = await this.transferClient.testConnection(device.ip, this.port + 1);
    if (!connected) {
      throw new Error('Cannot connect to target device');
    }

    // 发送传输请求
    const fs = require('fs');
    const stats = fs.statSync(transfer.filePath);
    
    await this.transferClient.sendTransferRequest(
      device.ip,
      this.port + 1,
      transfer.id,
      transfer.fileName,
      stats.size,
      device.id, // 使用设备 ID
      this.deviceName
    );

    // 发送文件
    await this.transferClient.sendFile(
      device.ip,
      this.port + 1,
      transfer.id,
      transfer.filePath,
      (progress) => {
        // 更新传输进度
        transfer.progress = progress.progress;
        transfer.sentSize = progress.sentBytes;
        transfer.speed = progress.speed;
        
        // 触发事件到渲染进程
        if (this.transferManager) {
          this.transferManager.emit('transfer-progress', transfer);
        }
      }
    );
  }

  /**
   * 设置传输事件监听
   */
  private setupTransferListeners(): void {
    if (!this.transferManager) return;

    // 传输创建
    this.transferManager.on('transfer-created', (transfer) => {
      this.mainWindow?.webContents.send('transfer-created', transfer);
    });

    // 传输开始
    this.transferManager.on('transfer-started', (transfer) => {
      this.mainWindow?.webContents.send('transfer-started', transfer);
    });

    // 传输进度
    this.transferManager.on('transfer-progress', (transfer) => {
      this.mainWindow?.webContents.send('transfer-progress', {
        transferId: transfer.id,
        fileName: transfer.fileName,
        percent: transfer.progress,
        speed: transfer.speed,
        sentSize: transfer.sentSize,
        totalSize: transfer.totalSize
      });
    });

    // 传输完成
    this.transferManager.on('transfer-completed', (transfer) => {
      this.mainWindow?.webContents.send('transfer-complete', {
        transferId: transfer.id,
        success: true,
        files: [{
          name: transfer.fileName,
          size: transfer.totalSize,
          path: transfer.filePath
        }]
      });
    });

    // 传输失败
    this.transferManager.on('transfer-failed', (transfer) => {
      this.mainWindow?.webContents.send('transfer-complete', {
        transferId: transfer.id,
        success: false,
        error: transfer.error
      });
    });

    // 发送进度
    this.transferManager.on('send-progress', (progress) => {
      this.mainWindow?.webContents.send('send-progress', progress);
    });

    // 发送完成
    this.transferManager.on('send-complete', (result) => {
      this.mainWindow?.webContents.send('send-complete', result);
    });
  }

  /**
   * 设置设备发现事件监听
   */
  private setupDiscoveryListeners(): void {
    if (!this.discovery) return;

    this.discovery.on('device-found', (device: Device) => {
      console.log('[ServiceAdapter] Device found:', device.name, device.ip);
      this.mainWindow?.webContents.send('device-found', device);
    });

    this.discovery.on('device-lost', (deviceId: string) => {
      console.log('[ServiceAdapter] Device lost:', deviceId);
      this.mainWindow?.webContents.send('device-lost', deviceId);
    });

    this.discovery.on('device-updated', (device: Device) => {
      this.mainWindow?.webContents.send('device-updated', device);
    });
  }

  /**
   * 获取设备列表（兼容旧接口）
   */
  getDevices(): Device[] {
    return this.discovery?.getDevices() || [];
  }

  /**
   * 获取设备发现服务
   */
  getDiscovery(): DiscoveryService | null {
    return this.discovery;
  }

  /**
   * 获取传输管理器
   */
  getTransferManager(): TransferManager | null {
    return this.transferManager;
  }

  /**
   * 获取断点续传管理器
   */
  getResumeManager(): ResumeManager | null {
    return this.resumeManager;
  }

  /**
   * 发送文件到设备
   */
  async sendFiles(deviceId: string, filePaths: string[]): Promise<string[]> {
    if (!this.transferManager) {
      throw new Error('Transfer manager not initialized');
    }

    const fs = require('fs');
    const path = require('path');
    const transferIds: string[] = [];

    for (const filePath of filePaths) {
      try {
        // 读取文件信息
        const stats = fs.statSync(filePath);
        const fileName = path.basename(filePath);

        // 创建 File 对象（Node.js 环境）
        const fileBuffer = fs.readFileSync(filePath);
        const file = new File([fileBuffer], fileName, {
          type: 'application/octet-stream',
          lastModified: stats.mtimeMs
        }) as any; // Node.js File 类型与浏览器 File 类型不完全兼容

        // 创建传输
        const transfer = this.transferManager.createTransfer(file, deviceId);
        transferIds.push(transfer.id);

        // 启动传输
        this.transferManager.start(transfer.id).catch(error => {
          console.error('[ServiceAdapter] Transfer failed:', error);
          this.mainWindow?.webContents.send('transfer-complete', {
            transferId: transfer.id,
            success: false,
            error: error.message
          });
        });

      } catch (error: any) {
        const fileName = path.basename(filePath);
        console.error('[ServiceAdapter] Failed to send file:', filePath, error);
        throw new Error(`Failed to send file ${fileName}: ${error.message}`);
      }
    }

    return transferIds;
  }

  /**
   * 接受传输（兼容旧接口）
   */
  acceptTransfer(transferId: string): void {
    if (!this.transferManager) {
      console.error('[ServiceAdapter] Transfer manager not initialized');
      return;
    }

    const transfer = this.transferManager.getTransfer(transferId);
    if (!transfer) {
      console.error('[ServiceAdapter] Transfer not found:', transferId);
      return;
    }

    // 如果传输是暂停状态，恢复它
    if (transfer.status === 'paused' || transfer.status === 'pending') {
      this.transferManager.start(transferId).catch(error => {
        console.error('[ServiceAdapter] Failed to accept transfer:', error);
      });
    }

    console.log('[ServiceAdapter] Transfer accepted:', transferId);
  }

  /**
   * 拒绝传输（兼容旧接口）
   */
  rejectTransfer(transferId: string): void {
    if (!this.transferManager) {
      console.error('[ServiceAdapter] Transfer manager not initialized');
      return;
    }

    this.transferManager.cancel(transferId);
    console.log('[ServiceAdapter] Transfer rejected:', transferId);
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    console.log('[ServiceAdapter] Cleaning up services...');
    
    await this.discovery?.stop();
    this.transferManager?.removeAllListeners();
    this.discovery?.removeAllListeners();
    this.transferServer?.stop();
    
    console.log('[ServiceAdapter] Cleanup complete');
  }
}
