# 架构重构实施指南

## 📋 目录

1. [Phase 1: 基础重构](#phase-1-基础重构)
2. [Phase 2: 功能增强](#phase-2-功能增强)
3. [Phase 3: 安全和性能](#phase-3-安全和性能)
4. [Phase 4: 测试和发布](#phase-4-测试和发布)

---

## Phase 1: 基础重构

### 1.1 创建核心目录结构

```bash
mkdir -p src/core/{services/{transport,transfer,discovery,storage},store/{slices,middleware},types,utils}
```

### 1.2 实现 UnifiedTransportService

**文件**: `src/core/services/transport/UnifiedTransport.ts`

```typescript
import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';

export interface TransportConfig {
  url: string;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export class UnifiedTransportService extends EventEmitter {
  private socket: Socket | null = null;
  private config: TransportConfig;
  private isConnecting = false;

  constructor(config: TransportConfig) {
    super();
    this.config = {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      ...config
    };
  }

  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    if (this.isConnecting) {
      throw new Error('Connection already in progress');
    }

    this.isConnecting = true;

    try {
      this.socket = io(this.config.url, {
        reconnection: this.config.reconnection,
        reconnectionAttempts: this.config.reconnectionAttempts,
        reconnectionDelay: this.config.reconnectionDelay,
        transports: ['websocket', 'polling']
      });

      await this.waitForConnection();
      this.setupEventHandlers();
      this.emit('connected');
    } finally {
      this.isConnecting = false;
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.emit('disconnected');
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  emit(event: string, data?: any): void {
    if (!this.socket?.connected) {
      throw new Error('Not connected');
    }
    this.socket.emit(event, data);
  }

  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.socket) {
      throw new Error('Socket not initialized');
    }
    this.socket.on(event, handler);
  }

  off(event: string, handler?: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.off(event, handler);
    }
  }

  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.socket!.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket!.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      this.emit('disconnected', reason);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      this.emit('reconnected', attemptNumber);
    });

    this.socket.on('reconnect_error', (error) => {
      this.emit('reconnect_error', error);
    });

    this.socket.on('error', (error) => {
      this.emit('error', error);
    });
  }
}
```

### 1.3 实现 TransferManager

**文件**: `src/core/services/transfer/TransferManager.ts`

```typescript
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface Transfer {
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
}

export interface TransferOptions {
  chunkSize?: number;
  maxConcurrent?: number;
  onProgress?: (progress: number) => void;
}

export class TransferManager extends EventEmitter {
  private transfers: Map<string, Transfer> = new Map();
  private activeTransfers: Set<string> = new Set();
  private maxConcurrent: number = 3;

  createTransfer(file: File, targetId: string, options?: TransferOptions): Transfer {
    const transfer: Transfer = {
      id: uuidv4(),
      fileName: file.name,
      fileSize: file.size,
      targetId,
      status: 'pending',
      progress: 0,
      speed: 0
    };

    this.transfers.set(transfer.id, transfer);
    this.emit('transfer-created', transfer);

    return transfer;
  }

  async start(transferId: string): Promise<void> {
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
      await this.executeTransfer(transfer);
      transfer.status = 'completed';
      transfer.endTime = Date.now();
      this.emit('transfer-completed', transfer);
    } catch (error) {
      transfer.status = 'failed';
      transfer.error = error as Error;
      this.emit('transfer-failed', transfer);
    } finally {
      this.activeTransfers.delete(transferId);
    }
  }

  pause(transferId: string): void {
    const transfer = this.transfers.get(transferId);
    if (transfer && transfer.status === 'active') {
      transfer.status = 'paused';
      this.activeTransfers.delete(transferId);
      this.emit('transfer-paused', transfer);
    }
  }

  resume(transferId: string): void {
    const transfer = this.transfers.get(transferId);
    if (transfer && transfer.status === 'paused') {
      this.start(transferId);
    }
  }

  cancel(transferId: string): void {
    const transfer = this.transfers.get(transferId);
    if (transfer) {
      transfer.status = 'failed';
      transfer.error = new Error('Transfer cancelled');
      this.activeTransfers.delete(transferId);
      this.emit('transfer-cancelled', transfer);
    }
  }

  getTransfer(id: string): Transfer | null {
    return this.transfers.get(id) || null;
  }

  getAllTransfers(): Transfer[] {
    return Array.from(this.transfers.values());
  }

  getActiveTransfers(): Transfer[] {
    return Array.from(this.activeTransfers)
      .map(id => this.transfers.get(id))
      .filter((t): t is Transfer => t !== undefined);
  }

  private async executeTransfer(transfer: Transfer): Promise<void> {
    // 实际传输逻辑将在 Phase 2 实现
    // 这里只是占位符
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

### 1.4 迁移到 Zustand

**文件**: `src/core/store/index.ts`

```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Device } from '../types/device';
import { Transfer } from '../services/transfer/TransferManager';
import { Settings } from '../types/common';

interface AppState {
  // Device state
  devices: Device[];
  currentDevice: Device | null;
  
  // Transfer state
  transfers: Transfer[];
  
  // History
  history: any[];
  
  // Settings
  settings: Settings;
  
  // UI state
  ui: {
    isConnected: boolean;
    isTransferring: boolean;
    selectedView: 'transfer' | 'history' | 'settings';
  };
  
  // Actions
  addDevice: (device: Device) => void;
  removeDevice: (deviceId: string) => void;
  setCurrentDevice: (device: Device | null) => void;
  
  addTransfer: (transfer: Transfer) => void;
  updateTransfer: (id: string, updates: Partial<Transfer>) => void;
  removeTransfer: (id: string) => void;
  
  updateSettings: (settings: Partial<Settings>) => void;
  
  setConnected: (connected: boolean) => void;
  setTransferring: (transferring: boolean) => void;
  setSelectedView: (view: 'transfer' | 'history' | 'settings') => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        devices: [],
        currentDevice: null,
        transfers: [],
        history: [],
        settings: {
          deviceName: 'My Device',
          downloadPath: '',
          autoAccept: false,
          showNotifications: true,
          theme: 'system',
          autoLaunch: false
        },
        ui: {
          isConnected: false,
          isTransferring: false,
          selectedView: 'transfer'
        },
        
        // Actions
        addDevice: (device) => set((state) => ({
          devices: [...state.devices, device]
        })),
        
        removeDevice: (deviceId) => set((state) => ({
          devices: state.devices.filter(d => d.id !== deviceId)
        })),
        
        setCurrentDevice: (device) => set({ currentDevice: device }),
        
        addTransfer: (transfer) => set((state) => ({
          transfers: [...state.transfers, transfer]
        })),
        
        updateTransfer: (id, updates) => set((state) => ({
          transfers: state.transfers.map(t => 
            t.id === id ? { ...t, ...updates } : t
          )
        })),
        
        removeTransfer: (id) => set((state) => ({
          transfers: state.transfers.filter(t => t.id !== id)
        })),
        
        updateSettings: (settings) => set((state) => ({
          settings: { ...state.settings, ...settings }
        })),
        
        setConnected: (connected) => set((state) => ({
          ui: { ...state.ui, isConnected: connected }
        })),
        
        setTransferring: (transferring) => set((state) => ({
          ui: { ...state.ui, isTransferring: transferring }
        })),
        
        setSelectedView: (view) => set((state) => ({
          ui: { ...state.ui, selectedView: view }
        }))
      }),
      {
        name: 'airdrop-storage',
        partialize: (state) => ({
          settings: state.settings,
          history: state.history
        })
      }
    )
  )
);
```

### 1.5 重构设备发现服务

**文件**: `src/core/services/discovery/DiscoveryService.ts`

```typescript
import { EventEmitter } from 'events';
import { Device } from '../../types/device';
import { MDNSDiscovery } from './MDNSDiscovery';
import { UDPDiscovery } from './UDPDiscovery';

export type DiscoveryMethod = 'mdns' | 'udp' | 'manual';

export class DiscoveryService extends EventEmitter {
  private method: DiscoveryMethod | null = null;
  private mdnsDiscovery: MDNSDiscovery | null = null;
  private udpDiscovery: UDPDiscovery | null = null;
  private devices: Map<string, Device> = new Map();

  async start(): Promise<void> {
    // 尝试 mDNS
    try {
      this.mdnsDiscovery = new MDNSDiscovery();
      await this.mdnsDiscovery.start();
      this.method = 'mdns';
      this.setupMDNSHandlers();
      console.log('[Discovery] Using mDNS');
      return;
    } catch (error) {
      console.warn('[Discovery] mDNS failed:', error);
    }

    // 回退到 UDP
    try {
      this.udpDiscovery = new UDPDiscovery();
      await this.udpDiscovery.start();
      this.method = 'udp';
      this.setupUDPHandlers();
      console.log('[Discovery] Using UDP broadcast');
    } catch (error) {
      console.error('[Discovery] All discovery methods failed:', error);
      this.method = 'manual';
    }
  }

  async stop(): Promise<void> {
    if (this.mdnsDiscovery) {
      await this.mdnsDiscovery.stop();
    }
    if (this.udpDiscovery) {
      await this.udpDiscovery.stop();
    }
    this.devices.clear();
  }

  getDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  addDevice(device: Device): void {
    this.devices.set(device.id, device);
    this.emit('device-found', device);
  }

  removeDevice(deviceId: string): void {
    if (this.devices.delete(deviceId)) {
      this.emit('device-lost', deviceId);
    }
  }

  getMethod(): DiscoveryMethod | null {
    return this.method;
  }

  private setupMDNSHandlers(): void {
    if (!this.mdnsDiscovery) return;

    this.mdnsDiscovery.on('device-found', (device: Device) => {
      this.addDevice(device);
    });

    this.mdnsDiscovery.on('device-lost', (deviceId: string) => {
      this.removeDevice(deviceId);
    });
  }

  private setupUDPHandlers(): void {
    if (!this.udpDiscovery) return;

    this.udpDiscovery.on('device-found', (device: Device) => {
      this.addDevice(device);
    });

    this.udpDiscovery.on('device-lost', (deviceId: string) => {
      this.removeDevice(deviceId);
    });
  }
}
```

---

## Phase 2: 功能增强

### 2.1 实现分片传输

**文件**: `src/core/services/transfer/ChunkManager.ts`

```typescript
export const CHUNK_SIZE = 1024 * 1024; // 1MB

export interface Chunk {
  index: number;
  start: number;
  end: number;
  data: Blob;
  uploaded: boolean;
}

export class ChunkManager {
  private chunks: Chunk[] = [];
  private file: File;

  constructor(file: File) {
    this.file = file;
    this.initializeChunks();
  }

  private initializeChunks(): void {
    const totalChunks = Math.ceil(this.file.size / CHUNK_SIZE);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, this.file.size);
      
      this.chunks.push({
        index: i,
        start,
        end,
        data: this.file.slice(start, end),
        uploaded: false
      });
    }
  }

  getChunk(index: number): Chunk | null {
    return this.chunks[index] || null;
  }

  getTotalChunks(): number {
    return this.chunks.length;
  }

  getUploadedChunks(): number {
    return this.chunks.filter(c => c.uploaded).length;
  }

  getRemainingChunks(): Chunk[] {
    return this.chunks.filter(c => !c.uploaded);
  }

  markChunkUploaded(index: number): void {
    const chunk = this.chunks[index];
    if (chunk) {
      chunk.uploaded = true;
    }
  }

  getProgress(): number {
    return (this.getUploadedChunks() / this.getTotalChunks()) * 100;
  }

  isComplete(): boolean {
    return this.getUploadedChunks() === this.getTotalChunks();
  }
}
```

### 2.2 实现断点续传

**文件**: `src/core/services/transfer/ResumeManager.ts`

```typescript
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface TransferDB extends DBSchema {
  transfers: {
    key: string;
    value: {
      id: string;
      fileName: string;
      fileSize: number;
      uploadedChunks: number[];
      totalChunks: number;
      createdAt: number;
      updatedAt: number;
    };
  };
}

export class ResumeManager {
  private db: IDBPDatabase<TransferDB> | null = null;

  async initialize(): Promise<void> {
    this.db = await openDB<TransferDB>('airdrop-transfers', 1, {
      upgrade(db) {
        db.createObjectStore('transfers', { keyPath: 'id' });
      }
    });
  }

  async saveTransferState(
    id: string,
    fileName: string,
    fileSize: number,
    uploadedChunks: number[],
    totalChunks: number
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.put('transfers', {
      id,
      fileName,
      fileSize,
      uploadedChunks,
      totalChunks,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  async loadTransferState(id: string) {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.get('transfers', id);
  }

  async deleteTransferState(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.delete('transfers', id);
  }

  async getAllTransfers() {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAll('transfers');
  }
}
```

### 2.3 实现并发控制

**文件**: `src/core/utils/ConcurrencyController.ts`

```typescript
export class ConcurrencyController {
  private maxConcurrent: number;
  private activeCount: number = 0;
  private queue: Array<() => Promise<any>> = [];
  private waiters: Array<() => void> = [];

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  async execute<T>(task: () => Promise<T>): Promise<T> {
    while (this.activeCount >= this.maxConcurrent) {
      await this.waitForSlot();
    }

    this.activeCount++;
    
    try {
      return await task();
    } finally {
      this.activeCount--;
      this.notifyWaiters();
    }
  }

  private waitForSlot(): Promise<void> {
    return new Promise(resolve => {
      this.waiters.push(resolve);
    });
  }

  private notifyWaiters(): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter();
    }
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  getQueueLength(): number {
    return this.waiters.length;
  }
}
```

---

## Phase 3: 安全和性能

### 3.1 实现身份验证

**文件**: `src/core/services/auth/AuthService.ts`

```typescript
export class AuthService {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly DEVICE_ID_KEY = 'device_id';

  static generatePairingCode(): string {
    return Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();
  }

  static async pairDevice(serverUrl: string, code: string): Promise<{
    deviceId: string;
    token: string;
  }> {
    const response = await fetch(`${serverUrl}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    if (!response.ok) {
      throw new Error('Pairing failed');
    }

    const { deviceId, token } = await response.json();
    
    this.saveToken(token);
    this.saveDeviceId(deviceId);

    return { deviceId, token };
  }

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static saveToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  static getDeviceId(): string | null {
    return localStorage.getItem(this.DEVICE_ID_KEY);
  }

  static saveDeviceId(deviceId: string): void {
    localStorage.setItem(this.DEVICE_ID_KEY, deviceId);
  }

  static isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
```

### 3.2 实现加密传输

**文件**: `src/core/utils/crypto.ts`

```typescript
export class CryptoUtils {
  static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  static async encryptData(
    data: ArrayBuffer,
    key: CryptoKey
  ): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      data
    );

    return { encrypted, iv };
  }

  static async decryptData(
    encrypted: ArrayBuffer,
    key: CryptoKey,
    iv: Uint8Array
  ): Promise<ArrayBuffer> {
    return await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      encrypted
    );
  }

  static async exportKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('raw', key);
    return this.arrayBufferToBase64(exported);
  }

  static async importKey(keyData: string): Promise<CryptoKey> {
    const buffer = this.base64ToArrayBuffer(keyData);
    
    return await crypto.subtle.importKey(
      'raw',
      buffer,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );
  }

  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
```

---

## Phase 4: 测试和发布

### 4.1 单元测试示例

**文件**: `src/core/services/transfer/__tests__/TransferManager.test.ts`

```typescript
import { TransferManager } from '../TransferManager';

describe('TransferManager', () => {
  let manager: TransferManager;

  beforeEach(() => {
    manager = new TransferManager();
  });

  test('should create transfer', () => {
    const file = new File(['test'], 'test.txt');
    const transfer = manager.createTransfer(file, 'device-1');

    expect(transfer).toBeDefined();
    expect(transfer.fileName).toBe('test.txt');
    expect(transfer.status).toBe('pending');
  });

  test('should start transfer', async () => {
    const file = new File(['test'], 'test.txt');
    const transfer = manager.createTransfer(file, 'device-1');

    await manager.start(transfer.id);

    expect(transfer.status).toBe('completed');
  });

  test('should pause transfer', () => {
    const file = new File(['test'], 'test.txt');
    const transfer = manager.createTransfer(file, 'device-1');

    manager.pause(transfer.id);

    expect(transfer.status).toBe('paused');
  });
});
```

### 4.2 集成测试示例

**文件**: `src/core/__tests__/integration.test.ts`

```typescript
import { UnifiedTransportService } from '../services/transport/UnifiedTransport';
import { TransferManager } from '../services/transfer/TransferManager';

describe('Integration Tests', () => {
  test('should connect and transfer file', async () => {
    const transport = new UnifiedTransportService({
      url: 'http://localhost:8080'
    });

    await transport.connect();
    expect(transport.isConnected()).toBe(true);

    const manager = new TransferManager();
    const file = new File(['test'], 'test.txt');
    const transfer = manager.createTransfer(file, 'device-1');

    await manager.start(transfer.id);
    expect(transfer.status).toBe('completed');

    transport.disconnect();
  });
});
```

---

## 📝 迁移检查清单

### 代码迁移
- [ ] 创建新的目录结构
- [ ] 实现 UnifiedTransportService
- [ ] 实现 TransferManager
- [ ] 迁移到 Zustand
- [ ] 重构设备发现服务
- [ ] 实现分片传输
- [ ] 实现断点续传
- [ ] 实现并发控制
- [ ] 添加身份验证
- [ ] 实现加密传输

### 测试
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试通过
- [ ] 性能测试通过
- [ ] 兼容性测试通过

### 文档
- [ ] 更新 README
- [ ] 更新 API 文档
- [ ] 更新架构图
- [ ] 创建迁移指南

### 发布
- [ ] Beta 版本测试
- [ ] 用户反馈收集
- [ ] 正式版本发布
- [ ] 监控和优化

---

**文档版本**: 1.0  
**创建日期**: 2026-02-03  
**作者**: Technical Lead
