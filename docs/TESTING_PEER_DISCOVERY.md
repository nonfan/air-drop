# PeerJS 设备发现测试指南

## 测试目标

验证 PeerJS 设备发现功能是否正常工作，包括：
1. 设备能否成功连接到 PeerServer
2. 设备能否相互发现
3. 设备信息是否正确交换
4. Socket.IO 文件传输是否正常

## 测试环境

### 场景 1：同一局域网
- 设备 A：桌面端（192.168.0.2）
- 设备 B：桌面端（192.168.0.3）
- 预期：通过 PeerJS 发现 + Socket.IO 传输

### 场景 2：不同网络
- 设备 A：家庭网络（192.168.0.2）
- 设备 B：移动热点（192.168.43.1）
- 预期：通过公共 PeerServer 发现

## 测试步骤

### 1. 启动应用

```bash
# 设备 A
npm run dev

# 设备 B（新终端）
npm run dev
```

### 2. 检查 PeerJS 连接

打开开发者工具（Ctrl+Shift+I），查看控制台：

```
✅ 成功标志：
[PeerDiscovery] Started with Peer ID: abc123xyz
[ServiceManager] PeerDiscovery started successfully

❌ 失败标志：
[ServiceManager] Failed to start PeerDiscovery: Error...
```

### 3. 检查设备发现

**预期日志：**
```
[PeerDiscovery] Incoming connection from: def456uvw
[PeerDiscovery] Sent device info to: def456uvw
[PeerDiscovery] New device discovered: {
  id: 'def456uvw',
  name: 'Windows',
  ip: '192.168.0.3',
  port: 8888,
  socketUrl: 'http://192.168.0.3:8888'
}
[ServiceManager] Device discovered via Peer: {...}
```

### 4. 检查设备列表

在应用界面中：
- ✅ 应该看到对方设备
- ✅ 设备名称正确
- ✅ 设备类型正确（PC/Mobile）

### 5. 测试文件传输

1. 选择一个文件
2. 点击对方设备发送
3. 观察传输进度

**预期行为：**
- ✅ 文件传输开始
- ✅ 进度条正常更新
- ✅ 传输完成后文件可打开

## 调试技巧

### 查看 Peer ID

```javascript
// 在开发者工具控制台执行
console.log('My Peer ID:', window.peerDiscovery?.getPeerId());
```

### 查看已发现的设备

```javascript
// 在开发者工具控制台执行
console.log('Discovered devices:', window.peerDiscovery?.getDevices());
```

### 手动连接到 Peer

```javascript
// 在开发者工具控制台执行
window.peerDiscovery?.connectToPeer('对方的PeerID');
```

## 常见问题

### 1. 无法连接到 PeerServer

**症状：**
```
[PeerDiscovery] Error: Connection timeout
```

**解决方案：**
- 检查网络连接
- 尝试使用自建 PeerServer
- 检查防火墙设置

### 2. 设备无法相互发现

**症状：**
- 两个设备都连接成功
- 但看不到对方

**解决方案：**
```javascript
// 手动触发连接
// 在设备 A 的控制台
window.peerDiscovery?.connectToPeer('设备B的PeerID');
```

### 3. 文件传输失败

**症状：**
- 设备已发现
- 但文件传输失败

**检查：**
1. Socket.IO 服务器是否运行
2. 端口 8888 是否可访问
3. 防火墙是否阻止

```bash
# 测试 Socket.IO 连接
curl http://192.168.0.2:8888
```

## 性能测试

### 发现速度

记录从启动到发现设备的时间：

```
启动应用 → 连接 PeerServer → 发现设备
预期：< 5 秒
```

### 传输速度

测试不同大小文件的传输速度：

```
小文件（1MB）：  < 1 秒
中文件（10MB）： < 5 秒
大文件（100MB）：< 30 秒
```

## 网络拓扑测试

### 测试 1：直连（同一路由器）

```
设备 A ←→ 路由器 ←→ 设备 B
```

预期：
- 发现速度：快（< 3 秒）
- 传输速度：快（局域网速度）

### 测试 2：跨网段（不同路由器）

```
设备 A ←→ 路由器 A ←→ Internet ←→ 路由器 B ←→ 设备 B
```

预期：
- 发现速度：中等（3-10 秒）
- 传输速度：取决于网络带宽

### 测试 3：移动网络

```
设备 A ←→ WiFi ←→ Internet ←→ 4G/5G ←→ 设备 B
```

预期：
- 发现速度：慢（5-15 秒）
- 传输速度：取决于移动网络

## 压力测试

### 多设备发现

启动 3+ 个设备实例：

```bash
# 终端 1
npm run dev

# 终端 2
set ELECTRON_USER_DATA=./test-instance-2
npm run dev

# 终端 3
set ELECTRON_USER_DATA=./test-instance-3
npm run dev
```

预期：
- ✅ 所有设备相互发现
- ✅ 设备列表正确显示
- ✅ 可以向任意设备发送文件

### 长时间运行

保持应用运行 1 小时+：

检查：
- ✅ 设备列表保持更新
- ✅ 没有内存泄漏
- ✅ 连接保持稳定

## 成功标准

### 基础功能
- ✅ 设备能连接到 PeerServer
- ✅ 设备能相互发现
- ✅ 设备信息正确显示
- ✅ 文件传输正常工作

### 性能指标
- ✅ 发现速度 < 10 秒
- ✅ 传输速度正常
- ✅ CPU 占用 < 10%
- ✅ 内存占用 < 200MB

### 稳定性
- ✅ 长时间运行无崩溃
- ✅ 网络波动自动恢复
- ✅ 设备离线正确处理

## 下一步

测试通过后：
1. 合并到主分支
2. 发布正式版本
3. 更新用户文档
4. 收集用户反馈

测试失败时：
1. 记录详细错误日志
2. 分析问题原因
3. 修复并重新测试
4. 更新测试用例
