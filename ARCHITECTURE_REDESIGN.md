# Airdrop 项目架构重新设计方案

## 📋 执行摘要

作为产品经理，经过对项目的全面分析，我发现了以下**严重的架构问题**：

### 🚨 核心问题

1. **多协议混乱**：同时使用 PeerJS、WebSocket、Socket.IO、HTTP，协议栈过于复杂
2. **服务耦合严重**：4个独立服务（Discovery、Transfer、PeerTransfer、WebServer）相互依赖
3. **状态管理混乱**：进度状态在多个组件间传递，缺乏统一管理
4. **代码重复**：桌面端和移动端大量重复逻辑
5. **错误处理不足**：缺乏统一的错误处理和重试机制
6. **性能问题**：文件传输没有分片、断点续传、并发控制
7. **安全隐患**：缺乏身份验证、加密传输、权限控制

### 💡 重新设计目标

- **简化架构**：统一通信协议，减少服务数量
- **提升性能**：实现分片传输、断点续传、并发控制
- **增强安全**：添加身份验证、加密传输
- **改善体验**：统一状态管理，优化错误处理
- **提高可维护性**：模块化设计，清晰的职责划分

---

## 🏗️ 新架构设计

### 1. 核心原则

#### 1.1 单一通信协议
**决策：统一使用 Socket.IO + HTTP**

- **Socket.IO**：用于信令、状态同步、设备发现
- **HTTP/HTTPS**：用于文件传输（支持流式、断点续传）
- **移除**：PeerJS（过于复杂）、原生 WebSocket（Socket.IO 已包含）

**理由**：
- Socket.IO 提供自动重连、心跳检测、房间管理
- HTTP 文件传输更稳定，支持 Range 请求
- 减少依赖，降低复杂度

#### 1.2 分层架构

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│  ┌──────────────────┐         ┌──────────────────┐     │
│  │  Desktop UI      │         │   Mobile UI      │     │
│  │  (Electron)      │         │   (PWA)          │     │
│  └──────────────────┘         └──────────────────┘     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │         State Management (Zustand/Redux)         │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Business Logic (Services)                │  │
│  │  • TransferService  • DiscoveryService           │  │
│  │  • HistoryService   • SettingsService            │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   Communication Layer                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Unified Transport (Socket.IO + HTTP)     │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                      Data Layer                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  • File System  • IndexedDB  • Electron Store    │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 2. 服务重新设计

#### 2.1 统一传输服务 (UnifiedTransportService)

**职责**：
- 管理所有网络通信（Socket.IO + HTTP）
- 提供统一的 API 接口
- 处理连接管理、重连、心跳

**接口设计**：
```typescript
interface UnifiedTransportService {
  // 连接管理
  connect(url: string): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  
  // 消息通信
  emit(event: string, data: any): void;
  on(event: string, handler: Function): void;
  
  // 文件传输
  sendFile(file: File, targetId: string, options?: TransferOptions): Promise<TransferResult>;
  receiveFile(fileId: string, options?: TransferOptions): Promise<Blob>;
  
  // 进度监听
  onProgress(transferId: string, callback: ProgressCallback): void;
}
```

#### 2.2 传输管理器 (TransferManager)

**职责**：
- 管理所有传输任务
- 实现分片、断点续传、并发控制
- 统一进度管理

**核心功能**：
```typescript
class TransferManager {
  private transfers: Map<string, Transfer>;
  private queue: TransferQueue;
  
  // 创建传输任务
  createTransfer(file: File, target: string): Transfer;
  
  // 任务控制
  start(transferId: string): void;
  pause(transferId: string): void;
  resume(transferId: string): void;
  cancel(transferId: string): void;
  
  // 批量操作
  startAll(): void;
  pauseAll(): void;
  
  // 状态查询
  getTransfer(id: string): Transfer | null;
  getAllTransfers(): Transfer[];
  getActiveTransfers(): Transfer[];
}
```

#### 2.3 设备发现服务 (DiscoveryService)

**简化设计**：
```typescript
class DiscoveryService {
  private discoveryMethod: 'udp' | 'mdns' | 'manual';
  
  // 自动选择最佳发现方式
  async start(): Promise<void> {
    try {
      await this.startMDNS();
      this.discoveryMethod = 'mdns';
    } catch {
      await this.startUDP();
      this.discoveryMethod = 'udp';
    }
  }
  
  // 统一的设备列表
  getDevices(): Device[];
  
  // 手动添加设备
  addDevice(ip: string, port: number): void;
}
```

### 3. 状态管理重新设计

#### 3.1 使用 Zustand 统一状态管理

**理由**：
- 比 Redux 更简单，无需 actions/reducers
- 支持 TypeScript
- 性能优秀
- 可在 Electron 和 Web 中共享

**状态结构**：
```typescript
interface AppState {
  // 设备状态
  devices: Device[];
  currentDevice: Device | null;
  
  // 传输状态
  transfers: Transfer[];
  activeTransfers: Transfer[];
  
  // 历史记录
  history: HistoryItem[];
  
  // 设置
  settings: Settings;
  
  // UI 状态
  ui: {
    isConnected: boolean;
    isTransferring: boolean;
    selectedView: 'transfer' | 'history' | 'settings';
  };
  
  // Actions
  addDevice: (device: Device) => void;
  removeDevice: (deviceId: string) => void;
  startTransfer: (file: File, targetId: string) => void;
  // ...
}
```

### 4. 文件传输优化

#### 4.1 分片传输

**实现方案**：
```typescript
const CHUNK_SIZE = 1024 * 1024; // 1MB per chunk

async function sendFileInChunks(file: File, targetId: string) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const transferId = generateId();
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    await uploadChunk({
      transferId,
      chunkIndex: i,
      totalChunks,
      data: chunk
    });
    
    // 更新进度
    const progress = ((i + 1) / totalChunks) * 100;
    updateProgress(transferId, progress);
  }
}
```

#### 4.2 断点续传

**实现方案**：
```typescript
interface TransferState {
  transferId: string;
  fileName: string;
  fileSize: number;
  uploadedChunks: Set<number>;
  totalChunks: number;
}

// 保存传输状态到 IndexedDB
async function saveTransferState(state: TransferState): Promise<void>;

// 恢复传输
async function resumeTransfer(transferId: string): Promise<void> {
  const state = await loadTransferState(transferId);
  const remainingChunks = getRemainingChunks(state);
  
  for (const chunkIndex of remainingChunks) {
    await uploadChunk(transferId, chunkIndex);
  }
}
```

#### 4.3 并发控制

**实现方案**：
```typescript
class ConcurrencyController {
  private maxConcurrent = 3;
  private activeCount = 0;
  private queue: Task[] = [];
  
  async execute<T>(task: () => Promise<T>): Promise<T> {
    while (this.activeCount >= this.maxConcurrent) {
      await this.waitForSlot();
    }
    
    this.activeCount++;
    try {
      return await task();
    } finally {
      this.activeCount--;
      this.processQueue();
    }
  }
}
```

### 5. 安全性增强

#### 5.1 身份验证

**方案**：
```typescript
// 生成配对码
function generatePairingCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 配对流程
async function pairDevice(code: string): Promise<Device> {
  const response = await fetch(`/api/pair`, {
    method: 'POST',
    body: JSON.stringify({ code })
  });
  
  const { deviceId, token } = await response.json();
  
  // 保存 token
  localStorage.setItem('auth_token', token);
  
  return { deviceId, token };
}
```

#### 5.2 加密传输

**方案**：
```typescript
// 使用 Web Crypto API
async function encryptFile(file: File, key: CryptoKey): Promise<ArrayBuffer> {
  const data = await file.arrayBuffer();
  return await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: generateIV() },
    key,
    data
  );
}

// 生成共享密钥
async function generateSharedKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}
```

### 6. 错误处理和重试机制

#### 6.1 统一错误处理

**实现方案**：
```typescript
class ErrorHandler {
  private errorHandlers: Map<ErrorType, ErrorHandlerFn> = new Map();
  
  register(type: ErrorType, handler: ErrorHandlerFn): void {
    this.errorHandlers.set(type, handler);
  }
  
  handle(error: AppError): void {
    const handler = this.errorHandlers.get(error.type);
    if (handler) {
      handler(error);
    } else {
      this.defaultHandler(error);
    }
  }
  
  private defaultHandler(error: AppError): void {
    console.error('[ErrorHandler]', error);
    showNotification({
      type: 'error',
      message: error.message
    });
  }
}
```

#### 6.2 自动重试机制

**实现方案**：
```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, i);
      await sleep(delay);
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## 📁 新的项目结构

```
src/
├── core/                      # 核心层（共享）
│   ├── services/
│   │   ├── transport/         # 统一传输服务
│   │   │   ├── UnifiedTransport.ts
│   │   │   ├── SocketManager.ts
│   │   │   └── HttpClient.ts
│   │   ├── transfer/          # 传输管理
│   │   │   ├── TransferManager.ts
│   │   │   ├── ChunkManager.ts
│   │   │   └── ProgressTracker.ts
│   │   ├── discovery/         # 设备发现
│   │   │   ├── DiscoveryService.ts
│   │   │   ├── MDNSDiscovery.ts
│   │   │   └── UDPDiscovery.ts
│   │   └── storage/           # 存储服务
│   │       ├── HistoryStorage.ts
│   │       └── SettingsStorage.ts
│   ├── store/                 # 状态管理
│   │   ├── index.ts
│   │   ├── slices/
│   │   │   ├── deviceSlice.ts
│   │   │   ├── transferSlice.ts
│   │   │   └── settingsSlice.ts
│   │   └── middleware/
│   ├── types/                 # 类型定义
│   │   ├── device.ts
│   │   ├── transfer.ts
│   │   └── common.ts
│   └── utils/                 # 工具函数
│       ├── crypto.ts
│       ├── retry.ts
│       └── validation.ts
│
├── desktop/                   # 桌面端（Electron）
│   ├── main/                  # 主进程
│   │   ├── index.ts
│   │   ├── window.ts
│   │   ├── tray.ts
│   │   └── ipc/
│   └── renderer/              # 渲染进程
│       ├── App.tsx
│       ├── components/
│       └── hooks/
│
├── mobile/                    # 移动端（PWA）
│   ├── App.tsx
│   ├── components/
│   ├── hooks/
│   └── sw.ts                  # Service Worker
│
└── server/                    # 服务端（可选）
    ├── index.ts
    ├── routes/
    └── middleware/
```

---

## 🚀 实施计划

### Phase 1: 基础重构（2周）
- [ ] 实现 UnifiedTransportService
- [ ] 实现 TransferManager（基础版）
- [ ] 迁移到 Zustand 状态管理
- [ ] 重构设备发现服务

### Phase 2: 功能增强（2周）
- [ ] 实现分片传输
- [ ] 实现断点续传
- [ ] 添加并发控制
- [ ] 优化进度显示

### Phase 3: 安全和性能（1周）
- [ ] 添加身份验证
- [ ] 实现加密传输
- [ ] 性能优化和测试
- [ ] 错误处理完善

### Phase 4: 测试和发布（1周）
- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能测试
- [ ] 文档更新

---

## 📊 预期收益

### 性能提升
- 传输速度提升 **30-50%**（分片+并发）
- 内存占用降低 **40%**（流式处理）
- 启动时间减少 **50%**（服务简化）

### 可维护性
- 代码量减少 **30%**
- 服务数量从 4 个减少到 2 个
- 依赖包减少 **20%**

### 用户体验
- 断点续传支持
- 更准确的进度显示
- 更好的错误提示
- 更快的设备发现

---

## ⚠️ 风险和挑战

### 技术风险
1. **兼容性问题**：新架构可能与旧版本不兼容
   - **缓解措施**：提供迁移工具，保留旧版本支持

2. **性能回退**：重构可能引入新的性能问题
   - **缓解措施**：充分的性能测试，逐步迁移

3. **学习曲线**：团队需要学习新的架构和工具
   - **缓解措施**：提供培训和文档

### 业务风险
1. **开发周期**：重构需要 6 周时间
   - **缓解措施**：分阶段实施，保持功能可用

2. **用户影响**：可能影响现有用户
   - **缓解措施**：Beta 测试，逐步推出

---

## 🎯 成功指标

### 技术指标
- [ ] 代码覆盖率 > 80%
- [ ] 传输成功率 > 99%
- [ ] 平均传输速度提升 > 30%
- [ ] 内存占用降低 > 30%

### 用户指标
- [ ] 用户满意度 > 4.5/5
- [ ] 崩溃率 < 0.1%
- [ ] 日活用户增长 > 20%

---

## 📝 总结

当前架构存在严重的复杂性和可维护性问题。通过这次重新设计，我们将：

1. **简化架构**：从 4 个服务减少到 2 个核心服务
2. **统一协议**：使用 Socket.IO + HTTP 替代多协议混合
3. **提升性能**：实现分片、断点续传、并发控制
4. **增强安全**：添加身份验证和加密传输
5. **改善体验**：统一状态管理，优化错误处理

这是一个**必要且紧急**的重构，建议立即启动实施。

---

**文档版本**: 1.0  
**创建日期**: 2026-02-03  
**作者**: Product Manager  
**审核状态**: 待审核
