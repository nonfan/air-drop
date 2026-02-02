# PeerJS 工作原理详解

## 核心误解：PeerJS 不能"发现"设备

**重要：PeerJS 并不能自动发现局域网设备！** 它只是简化了 WebRTC 的连接过程。

---

## PeerJS 的真实工作流程

### 1. 你的代码中的实现

```typescript
// 桌面端生成 Peer ID
this.peerId = `airdrop-${this.deviceName}-${Date.now()}`;
this.peer = new Peer(this.peerId, {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  }
});

// 连接到另一个设备
const conn = this.peer.connect(peerId); // ← 关键：你必须知道对方的 peerId
```

**问题：你怎么知道对方的 `peerId`？**

答案：**你必须通过其他方式告诉对方！**

---

## PeerJS 的三个组成部分

### 1. 信令服务器（Signaling Server）

**作用：** 交换连接信息（SDP、ICE candidates）

**默认服务器：** `0.peerjs.com`（PeerJS 官方提供的免费服务器）

```
设备 A                    信令服务器                    设备 B
  |                           |                           |
  |-- 注册 (ID: airdrop-A) -->|                           |
  |                           |<-- 注册 (ID: airdrop-B) --|
  |                           |                           |
  |-- 请求连接 airdrop-B ---->|                           |
  |                           |-- 转发连接请求 ---------->|
  |                           |                           |
  |<-- 返回 SDP/ICE ---------|<-- 发送 SDP/ICE ----------|
  |                           |                           |
  |========== 建立 P2P 连接 ==========================>|
  |                           |                           |
  |<========== 数据传输（不经过服务器）===============>|
```

**关键点：**
- ✅ 信令服务器只用于**交换连接信息**
- ✅ 实际数据传输是 **P2P 的**，不经过服务器
- ❌ 信令服务器**不提供设备发现功能**

### 2. STUN 服务器

**作用：** 帮助设备发现自己的公网 IP 地址（NAT 穿透）

```typescript
iceServers: [
  { urls: 'stun:stun.l.google.com:19302' }
]
```

**工作原理：**
```
设备 A (192.168.1.100)
  |
  |-- 我的公网 IP 是什么？
  |
STUN 服务器 (stun.l.google.com)
  |
  |-- 你的公网 IP 是 203.0.113.45
  |
设备 A 现在知道自己的公网地址
```

**关键点：**
- ✅ 用于 NAT 穿透
- ❌ **不提供设备发现功能**

### 3. WebRTC 数据通道

**作用：** P2P 数据传输

一旦连接建立，数据直接在两个设备之间传输，不经过任何服务器。

---

## 为什么 PeerJS 不能"发现"设备

### 问题 1：没有设备列表 API

PeerJS 的信令服务器**不提供**获取在线设备列表的 API。

```javascript
// ❌ 这个 API 不存在
peer.listOnlineDevices(); // TypeError: peer.listOnlineDevices is not a function

// ❌ 这个也不存在
peer.discoverPeers(); // TypeError: peer.discoverPeers is not a function
```

### 问题 2：Peer ID 是私有的

每个设备的 Peer ID 是**私有信息**，只有：
1. 设备自己知道
2. 主动连接到该设备的其他设备知道

**没有办法查询"所有在线的 Peer ID"。**

### 问题 3：必须预先知道 Peer ID

要连接到另一个设备，你**必须**预先知道它的 Peer ID：

```typescript
// 你必须知道对方的 peerId
const conn = this.peer.connect('airdrop-OtherDevice-1234567890');
```

**问题：你怎么知道这个 ID？**

---

## 你的应用是如何工作的

### 当前架构

```
桌面端 A                                    桌面端 B
  |                                           |
  |-- 生成 Peer ID: airdrop-A-123            |-- 生成 Peer ID: airdrop-B-456
  |                                           |
  |-- 通过 mDNS/UDP 广播 Peer ID ----------->|
  |<-- 通过 mDNS/UDP 广播 Peer ID -----------|
  |                                           |
  |-- 现在知道对方的 Peer ID                 |
  |                                           |
  |-- peer.connect('airdrop-B-456') -------->|
  |                                           |
  |<========== WebRTC P2P 连接 =============>|
```

**关键步骤：**
1. ✅ 使用 **mDNS/UDP 广播** 交换 Peer ID
2. ✅ 使用 **PeerJS** 建立 WebRTC 连接
3. ✅ 使用 **WebRTC 数据通道** 传输文件

**PeerJS 的作用：** 简化 WebRTC 连接，**不是**设备发现。

---

## iOS 为什么不能用 PeerJS "发现"设备

### 问题：iOS 无法获取 Peer ID

```
桌面端                                      iOS Safari
  |                                           |
  |-- 生成 Peer ID: airdrop-PC-123           |-- 生成 Peer ID: airdrop-iOS-456
  |                                           |
  |-- 通过 mDNS 广播 Peer ID                 |
  |                                           |-- ❌ 无法接收 mDNS 广播
  |                                           |-- ❌ 无法进行 UDP 广播
  |                                           |
  |-- iOS 不知道桌面端的 Peer ID              |
  |                                           |
  |-- ❌ 无法连接                             |
```

**结论：** iOS Safari 无法通过 mDNS/UDP 获取桌面端的 Peer ID，所以无法建立 PeerJS 连接。

---

## 解决方案：通过 QR 码传递 Peer ID

### 正确的流程

```
桌面端                                      iOS Safari
  |                                           |
  |-- 生成 Peer ID: airdrop-PC-123           |
  |                                           |
  |-- 生成 QR 码（包含 Peer ID）              |
  |                                           |
  |                                           |-- 扫描 QR 码
  |                                           |-- 获取 Peer ID: airdrop-PC-123
  |                                           |
  |<-- peer.connect('airdrop-PC-123') -------|
  |                                           |
  |<========== WebRTC P2P 连接 =============>|
```

### 实现代码

**桌面端：**
```typescript
// 生成 Peer ID
const peerId = `airdrop-${deviceName}-${Date.now()}`;
const peer = new Peer(peerId);

peer.on('open', (id) => {
  // 生成包含 Peer ID 的 QR 码
  const qrContent = `https://your-app.com?peerId=${id}`;
  showQRCode(qrContent);
});

peer.on('connection', (conn) => {
  // 接收来自 iOS 的连接
  conn.on('data', (data) => {
    // 接收文件
  });
});
```

**iOS 端：**
```typescript
// 从 URL 获取 Peer ID
const params = new URLSearchParams(window.location.search);
const desktopPeerId = params.get('peerId');

// 连接到桌面端
const peer = new Peer();
peer.on('open', (myId) => {
  const conn = peer.connect(desktopPeerId);
  
  conn.on('open', () => {
    // 发送文件
    conn.send(fileData);
  });
});
```

---

## 其他应用是如何使用 PeerJS 的

### Snapdrop

**架构：** WebSocket 服务器 + PeerJS

```
设备 A                    WebSocket 服务器                设备 B
  |                           |                           |
  |-- 连接 WebSocket -------->|                           |
  |                           |<-- 连接 WebSocket --------|
  |                           |                           |
  |-- 发送 Peer ID ---------->|                           |
  |                           |-- 转发 Peer ID ---------->|
  |                           |                           |
  |<-- 接收 Peer ID ----------|<-- 发送 Peer ID ----------|
  |                           |                           |
  |-- 现在知道对方的 Peer ID   |                           |
  |                           |                           |
  |========== PeerJS 连接 ==========================>|
```

**关键：** 使用 WebSocket 服务器交换 Peer ID。

### ShareDrop

**架构：** Firebase + PeerJS

```
设备 A                    Firebase                      设备 B
  |                           |                           |
  |-- 加入房间 "room-123" --->|                           |
  |                           |<-- 加入房间 "room-123" ---|
  |                           |                           |
  |-- 写入 Peer ID ---------->|                           |
  |                           |-- 通知新设备 ------------>|
  |                           |                           |
  |<-- 读取 Peer ID ----------|<-- 写入 Peer ID ----------|
  |                           |                           |
  |========== PeerJS 连接 ==========================>|
```

**关键：** 使用 Firebase 实时数据库交换 Peer ID。

---

## 总结

### PeerJS 能做什么

- ✅ 简化 WebRTC 连接过程
- ✅ 提供免费的信令服务器
- ✅ 支持 P2P 数据传输
- ✅ 自动处理 NAT 穿透

### PeerJS 不能做什么

- ❌ **不能自动发现设备**
- ❌ 不能列出在线设备
- ❌ 不能在不知道 Peer ID 的情况下连接

### 你必须自己实现

- 🔧 **设备发现机制**（mDNS、UDP 广播、QR 码、WebSocket 等）
- 🔧 **Peer ID 交换**（通过你的发现机制）
- 🔧 **设备列表管理**

### 推荐架构

**桌面端之间：**
```
mDNS/UDP 广播（交换 Peer ID）→ PeerJS 连接 → P2P 传输
```

**桌面端 ↔ iOS：**
```
QR 码（传递 Peer ID）→ PeerJS 连接 → P2P 传输
```

**跨网络：**
```
WebSocket 服务器（交换 Peer ID）→ PeerJS 连接 → P2P 传输
```

---

## 常见误解

### ❌ 误解 1："PeerJS 可以发现设备"

**真相：** PeerJS 只是 WebRTC 的封装，不提供设备发现功能。

### ❌ 误解 2："PeerJS 服务器存储设备列表"

**真相：** PeerJS 服务器只是信令服务器，不存储或提供设备列表。

### ❌ 误解 3："只要用 PeerJS 就能解决 iOS 发现问题"

**真相：** PeerJS 无法解决 iOS 的设备发现问题，你仍然需要通过 QR 码等方式传递 Peer ID。

---

## 参考资料

- [PeerJS 官方文档](https://peerjs.com/docs/)
- [WebRTC 规范](https://www.w3.org/TR/webrtc/)
- [STUN/TURN 服务器](https://webrtc.org/getting-started/turn-server)
- [Snapdrop 源码](https://github.com/RobinLinus/snapdrop)

---

**结论：PeerJS 是一个很好的 P2P 传输工具，但它不能替代设备发现机制。你仍然需要通过 mDNS、UDP 广播、QR 码等方式让设备知道彼此的 Peer ID。**
