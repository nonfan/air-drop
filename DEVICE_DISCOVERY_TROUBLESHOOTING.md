# 设备发现问题排查指南

## 问题：局域网设备无法发现

### 可能的原因

1. **Bonjour 服务未安装/未运行**（Windows）
2. **防火墙阻止 mDNS 广播**
3. **网络隔离**（不同子网/VLAN）
4. **服务未正确启动**

---

## 解决方案

### 方案 1：检查 Bonjour 服务（Windows）

Windows 需要 Bonjour 服务才能使用 mDNS。

#### 检查是否已安装
1. 打开"服务"（Win + R → `services.msc`）
2. 查找 "Bonjour 服务" 或 "Bonjour Service"
3. 确保状态为"正在运行"

#### 如果未安装
下载并安装 Bonjour：
- 官方下载：https://support.apple.com/kb/DL999
- 或者安装 iTunes（包含 Bonjour）

#### 启动 Bonjour 服务
```powershell
# PowerShell（管理员）
Start-Service -Name "Bonjour Service"
Set-Service -Name "Bonjour Service" -StartupType Automatic
```

---

### 方案 2：配置防火墙

#### Windows Defender 防火墙

1. **允许 mDNS 端口（5353/UDP）**
```powershell
# PowerShell（管理员）
New-NetFirewallRule -DisplayName "mDNS (UDP-In)" -Direction Inbound -Protocol UDP -LocalPort 5353 -Action Allow
New-NetFirewallRule -DisplayName "mDNS (UDP-Out)" -Direction Outbound -Protocol UDP -LocalPort 5353 -Action Allow
```

2. **允许应用通过防火墙**
```powershell
# 允许 Electron 应用
New-NetFirewallRule -DisplayName "Airdrop" -Direction Inbound -Program "C:\path\to\Airdrop.exe" -Action Allow
```

#### 第三方防火墙
- 360、火绒等：手动添加应用到白名单
- 允许 UDP 5353 端口

---

### 方案 3：检查网络配置

#### 确保在同一子网
```powershell
# 查看本机 IP
ipconfig

# 确保两台设备的 IP 在同一网段
# 例如：192.168.1.100 和 192.168.1.101
```

#### 检查网络类型
- 确保网络类型为"专用网络"而非"公用网络"
- 设置 → 网络和 Internet → 以太网/Wi-Fi → 网络配置文件

---

### 方案 4：使用备用发现方式

如果 mDNS 无法工作，可以使用手动 IP 连接：

#### 修改代码支持手动添加设备

在 `src/renderer/components/DeviceList.tsx` 中添加手动输入功能：

```typescript
const [manualIP, setManualIP] = useState('');

const handleManualConnect = () => {
  if (manualIP) {
    const device: Device = {
      id: `manual-${Date.now()}`,
      name: `设备 ${manualIP}`,
      ip: manualIP,
      port: 3000
    };
    // 添加到设备列表
    onDeviceFound(device);
  }
};

// UI
<input 
  type="text" 
  placeholder="输入 IP 地址（如 192.168.1.100）"
  value={manualIP}
  onChange={(e) => setManualIP(e.target.value)}
/>
<button onClick={handleManualConnect}>手动连接</button>
```

---

### 方案 5：使用 WebSocket 广播（推荐）

如果 Bonjour 不可用，可以使用 WebSocket 广播替代：

#### 实现思路
1. 每个设备定期向局域网广播自己的信息
2. 监听其他设备的广播
3. 维护在线设备列表

#### 代码实现

创建 `src/main/services/broadcastDiscovery.ts`：

```typescript
import dgram from 'dgram';
import { EventEmitter } from 'events';
import { networkInterfaces } from 'os';

export class BroadcastDiscovery extends EventEmitter {
  private socket: dgram.Socket;
  private port: number = 3001;
  private broadcastInterval: NodeJS.Timeout | null = null;
  private devices: Map<string, any> = new Map();
  
  constructor(private deviceInfo: any) {
    super();
    this.socket = dgram.createSocket('udp4');
  }
  
  start() {
    this.socket.bind(this.port, () => {
      this.socket.setBroadcast(true);
      console.log('Broadcast discovery started on port', this.port);
    });
    
    // 监听广播消息
    this.socket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'device-announce' && data.id !== this.deviceInfo.id) {
          this.devices.set(data.id, {
            ...data,
            ip: rinfo.address,
            lastSeen: Date.now()
          });
          this.emit('device-found', this.devices.get(data.id));
        }
      } catch (err) {
        console.error('Failed to parse broadcast message:', err);
      }
    });
    
    // 定期广播自己的信息
    this.broadcastInterval = setInterval(() => {
      this.broadcast();
      this.cleanupStaleDevices();
    }, 5000);
    
    // 立即广播一次
    this.broadcast();
  }
  
  private broadcast() {
    const message = JSON.stringify({
      type: 'device-announce',
      ...this.deviceInfo,
      timestamp: Date.now()
    });
    
    // 广播到所有网络接口
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          const broadcastAddr = this.getBroadcastAddress(net.address, net.netmask);
          this.socket.send(message, this.port, broadcastAddr);
        }
      }
    }
  }
  
  private getBroadcastAddress(ip: string, netmask: string): string {
    const ipParts = ip.split('.').map(Number);
    const maskParts = netmask.split('.').map(Number);
    const broadcast = ipParts.map((part, i) => part | (~maskParts[i] & 255));
    return broadcast.join('.');
  }
  
  private cleanupStaleDevices() {
    const now = Date.now();
    for (const [id, device] of this.devices.entries()) {
      if (now - device.lastSeen > 15000) { // 15秒未响应
        this.devices.delete(id);
        this.emit('device-lost', id);
      }
    }
  }
  
  stop() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }
    this.socket.close();
  }
}
```

#### 在 serviceManager.ts 中使用

```typescript
import { BroadcastDiscovery } from './broadcastDiscovery';

// 如果 Bonjour 不可用，使用广播发现
let discoveryService;
try {
  discoveryService = new DeviceDiscovery(deviceName, port);
  await discoveryService.start();
} catch (err) {
  console.warn('Bonjour discovery failed, using broadcast:', err);
  discoveryService = new BroadcastDiscovery({
    id: uuidv4(),
    name: deviceName,
    port: port
  });
  discoveryService.start();
}
```

---

## 调试步骤

### 1. 查看控制台日志

打开 Electron 开发者工具（Ctrl+Shift+I），查看：
```
[Discovery] Starting device discovery service...
[Discovery] Device ID: xxx
[Discovery] Published service: xxx
[Discovery] Found service: xxx
```

### 2. 测试 mDNS

使用命令行工具测试：

```bash
# Windows（需要安装 dns-sd）
dns-sd -B _windrop._tcp

# macOS/Linux
avahi-browse -a
```

### 3. 网络抓包

使用 Wireshark 抓包，过滤 mDNS：
```
udp.port == 5353
```

查看是否有 mDNS 广播包。

---

## 快速测试

### 测试脚本

创建 `test-discovery.js`：

```javascript
const Bonjour = require('bonjour-service');
const bonjour = new Bonjour();

// 发布服务
const service = bonjour.publish({
  name: 'Test Device',
  type: 'windrop',
  port: 3000
});

console.log('Published service');

// 查找服务
const browser = bonjour.find({ type: 'windrop' }, (service) => {
  console.log('Found device:', service.name, service.addresses);
});

setTimeout(() => {
  console.log('Stopping...');
  browser.stop();
  bonjour.unpublishAll();
  bonjour.destroy();
}, 10000);
```

运行：
```bash
node test-discovery.js
```

---

## 推荐方案

**优先级排序：**

1. ✅ **安装 Bonjour 服务**（最简单）
2. ✅ **配置防火墙**（必须）
3. ✅ **使用广播发现**（备用方案）
4. ✅ **手动 IP 连接**（最后手段）

---

## 常见问题

### Q: 为什么只能发现自己？
A: 检查是否过滤了本机 IP，代码中已经有 `this.localIPs.has(ip)` 的检查。

### Q: 为什么有时能发现，有时不能？
A: 可能是网络波动或防火墙间歇性阻止，建议使用广播发现作为备用。

### Q: 跨子网能发现吗？
A: mDNS 不支持跨子网，需要配置 mDNS 中继或使用中心服务器。

---

## 下一步

如果以上方案都无法解决，建议：
1. 实现广播发现作为备用
2. 添加手动 IP 连接功能
3. 考虑使用中心服务器（如 STUN/TURN）
