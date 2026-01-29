# 设备发现测试指南

## 快速测试步骤

### 1. 启动应用并查看日志

```bash
npm run dev
```

启动后，按 `Ctrl+Shift+I` 打开开发者工具，查看 Console 标签页。

### 2. 查找关键日志

#### ✅ 成功启动的标志

**Bonjour 模式（推荐）：**
```
[ServiceManager] Trying Bonjour discovery...
[Discovery] Starting device discovery service...
[Discovery] Device ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[Discovery] Device Name: Airdrop-xxxx
[Discovery] Port: 3000
[Discovery] Local IPs: ["127.0.0.1", "localhost", "192.168.x.x"]
[Discovery] Published service: Airdrop-xxxx-xxxx
[Discovery] Starting to browse for devices...
[Discovery] Device discovery service started
[ServiceManager] Bonjour discovery started successfully
```

**广播模式（备用）：**
```
[ServiceManager] Trying Bonjour discovery...
[ServiceManager] Bonjour discovery failed, using broadcast discovery: [错误信息]
[BroadcastDiscovery] Starting broadcast discovery...
[BroadcastDiscovery] Device ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[BroadcastDiscovery] Device Name: Airdrop-xxxx
[BroadcastDiscovery] Port: 3000
[BroadcastDiscovery] Listening on port 3001
[ServiceManager] Broadcast discovery started successfully
```

### 3. 在第二台设备上启动应用

确保两台设备：
- ✅ 连接到同一个 Wi-Fi/路由器
- ✅ 在同一个子网（例如都是 192.168.1.x）
- ✅ 防火墙允许应用通信

### 4. 观察设备发现日志

当发现其他设备时，应该看到：

**Bonjour 模式：**
```
[Discovery] Found service: Airdrop-xxxx ["192.168.1.100"]
[ServiceManager] Device found event: Airdrop-xxxx 192.168.1.100
```

**广播模式：**
```
[BroadcastDiscovery] Found device: Airdrop-xxxx 192.168.1.100
[ServiceManager] Device found event: Airdrop-xxxx 192.168.1.100
```

### 5. 检查 UI

在应用界面中，应该能看到发现的设备列表。

---

## 常见问题快速诊断

### 问题 1：看到 "Bonjour discovery failed"

**原因：** Windows 未安装 Bonjour 服务

**解决方案：**
1. 下载 Bonjour：https://support.apple.com/kb/DL999
2. 或安装 iTunes（包含 Bonjour）
3. 检查服务是否运行：
   - 按 `Win+R`，输入 `services.msc`
   - 查找 "Bonjour 服务"
   - 确保状态为"正在运行"

**临时方案：** 应用会自动切换到广播模式，功能不受影响。

### 问题 2：服务启动但无法发现设备

**可能原因：**
- 防火墙阻止
- 不同子网
- 网络隔离

**快速检查：**

1. **查看两台设备的 IP 地址**
   ```bash
   ipconfig
   ```
   确保在同一网段（例如都是 192.168.1.x）

2. **临时关闭防火墙测试**
   ```powershell
   # 以管理员身份运行
   Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False
   ```
   
   测试完成后记得重新开启：
   ```powershell
   Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
   ```

3. **如果关闭防火墙后能发现，则添加防火墙规则**
   ```powershell
   # Bonjour (mDNS)
   New-NetFirewallRule -DisplayName "mDNS" -Direction Inbound -Protocol UDP -LocalPort 5353 -Action Allow
   
   # 广播发现
   New-NetFirewallRule -DisplayName "Airdrop Broadcast" -Direction Inbound -Protocol UDP -LocalPort 3001 -Action Allow
   
   # 应用本身
   New-NetFirewallRule -DisplayName "Airdrop" -Direction Inbound -Program "C:\path\to\Airdrop.exe" -Action Allow
   ```

### 问题 3：只能发现自己

**原因：** 代码已经过滤了本机 IP，这不应该发生。

**检查：** 查看日志中是否有 "Skipping self device" 消息。

### 问题 4：间歇性发现

**原因：** 网络波动或防火墙间歇性阻止。

**解决：** 广播模式更稳定，如果 Bonjour 不稳定，可以强制使用广播模式。

---

## 高级调试

### 测试 Bonjour 是否工作

创建 `test-bonjour.js`：
```javascript
const Bonjour = require('bonjour-service');
const bonjour = new Bonjour();

console.log('Publishing test service...');
bonjour.publish({
  name: 'Test-' + Math.random().toString(36).slice(2, 6),
  type: 'airdrop',
  port: 3000
});

console.log('Browsing for services...');
bonjour.find({ type: 'airdrop' }, (service) => {
  console.log('✅ Found:', service.name, service.addresses);
});

console.log('Waiting 30 seconds...');
setTimeout(() => {
  console.log('Done');
  process.exit(0);
}, 30000);
```

运行：
```bash
node test-bonjour.js
```

在两台设备上同时运行，看是否能互相发现。

### 测试 UDP 广播是否工作

创建 `test-broadcast.js`：
```javascript
const dgram = require('dgram');
const socket = dgram.createSocket('udp4');

const PORT = 3001;
const deviceId = 'test-' + Math.random().toString(36).slice(2, 6);

socket.bind(PORT, () => {
  socket.setBroadcast(true);
  console.log('✅ Listening on port', PORT);
  console.log('Device ID:', deviceId);
});

socket.on('message', (msg, rinfo) => {
  try {
    const data = JSON.parse(msg.toString());
    if (data.id !== deviceId) {
      console.log('✅ Received from', rinfo.address + ':', data.id);
    }
  } catch (e) {}
});

setInterval(() => {
  const message = JSON.stringify({
    type: 'test',
    id: deviceId,
    timestamp: Date.now()
  });
  
  // 广播到 255.255.255.255
  socket.send(message, PORT, '255.255.255.255', (err) => {
    if (err) {
      console.error('❌ Broadcast error:', err.message);
    } else {
      console.log('📡 Broadcast sent');
    }
  });
}, 5000);

console.log('Press Ctrl+C to stop');
```

运行：
```bash
node test-broadcast.js
```

在两台设备上同时运行，看是否能互相接收广播。

---

## 网络抓包（高级）

如果以上都无法解决，可以使用 Wireshark 抓包分析：

1. 下载 Wireshark：https://www.wireshark.org/
2. 启动 Wireshark，选择当前网络接口
3. 过滤 mDNS：`udp.port == 5353`
4. 过滤广播：`udp.port == 3001`
5. 查看是否有数据包

---

## 报告问题时请提供

如果仍然无法解决，请提供以下信息：

1. **完整的控制台日志**（从启动到发现失败）
2. **两台设备的 IP 地址**（运行 `ipconfig`）
3. **操作系统版本**（Windows 10/11）
4. **防火墙软件**（Windows Defender / 360 / 火绒等）
5. **网络环境**
   - 家庭路由器 / 公司网络 / 学校网络
   - 路由器型号
   - 是否使用 VPN
6. **测试脚本结果**（test-bonjour.js 和 test-broadcast.js）

---

## 预期结果

✅ 应用启动后，在控制台看到设备发现服务启动的日志
✅ 在第二台设备启动后，两台设备都能在日志中看到对方
✅ UI 中显示发现的设备列表
✅ 可以选择设备并发送文件

---

## 下一步

测试完成后，请告诉我：
1. 使用的是 Bonjour 还是广播模式？
2. 能否发现其他设备？
3. 如果不能，看到了什么错误日志？
