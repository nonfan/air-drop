# iOS 文件上传调试指南

## 问题：iOS 浏览器无法发送文件/视频到桌面端

### 调试步骤：

#### 1. 打开 iOS Safari 的开发者工具

**在 Mac 上：**
1. 连接 iPhone/iPad 到 Mac
2. 在 iPhone 上打开 Safari，访问应用
3. 在 Mac 上打开 Safari → 开发 → [你的设备名] → [网页]
4. 查看控制台日志

**使用 Eruda（无需 Mac）：**
在应用中添加以下代码临时启用移动端调试工具：
```javascript
// 在 src/web/main.tsx 顶部添加
if (import.meta.env.DEV || window.location.search.includes('debug')) {
  import('eruda').then(eruda => eruda.default.init());
}
```

#### 2. 检查控制台日志

查找以下关键日志：

**文件选择：**
```
[FileSelect] File metadata: video.mp4, 25000000 bytes, video/mp4
```

**开始上传：**
```
[SendFiles] Starting upload: { deviceId: "xxx", filesCount: 1, files: [...] }
[SendFiles] Upload URL: http://192.168.0.2:8080/api/upload
[SendFiles] Sending FormData...
```

**上传进度：**
```
[Upload] Progress: video.mp4 10% (2500000/25000000)
[Upload] Progress: video.mp4 50% (12500000/25000000)
```

**上传完成：**
```
[SendFiles] Upload complete, status: 200
[SendFiles] All files uploaded successfully
```

#### 3. 常见问题和解决方案

##### 问题 A：文件选择后没有显示在列表中
**可能原因：**
- File 对象创建失败
- 文件大小为 0
- 文件类型不支持

**检查：**
```javascript
// 查看控制台是否有这条日志
[FileSelect] File metadata: ...
```

**解决：**
- 确保文件不是空文件
- 尝试选择不同类型的文件（图片、文档）

##### 问题 B：点击发送后没有反应
**可能原因：**
- Socket.IO 未连接
- 没有选择目标设备
- 文件列表为空

**检查：**
```javascript
// 查看控制台是否有这条日志
[SendFiles] Missing requirements: { hasSocket: true, hasDevice: true, filesCount: 1 }
```

**解决：**
- 确保已连接到服务器（查看设备列表是否显示桌面端）
- 确保已选择目标设备
- 确保文件列表不为空

##### 问题 C：上传开始但立即失败
**可能原因：**
- 网络连接问题
- CORS 问题
- 服务器未响应

**检查：**
```javascript
// 查看控制台错误
[SendFiles] Upload error: ...
[SendFiles] Upload failed: 500
```

**解决：**
- 检查网络连接（ping 服务器 IP）
- 检查服务器是否正在运行
- 检查防火墙设置

##### 问题 D：上传进度卡在某个百分比
**可能原因：**
- 网络不稳定
- 文件太大，iOS 内存限制
- 服务器处理慢

**检查：**
```javascript
// 查看最后的进度日志
[Upload] Progress: video.mp4 45% (...)
```

**解决：**
- 尝试较小的文件
- 检查 WiFi 信号强度
- 等待更长时间（大文件需要时间）

##### 问题 E：上传完成但服务器返回错误
**可能原因：**
- 服务器磁盘空间不足
- 文件名包含特殊字符
- 服务器权限问题

**检查：**
```javascript
// 查看服务器响应
[SendFiles] Upload failed: 500 Internal Server Error
```

**解决：**
- 检查服务器磁盘空间
- 重命名文件（移除特殊字符）
- 检查服务器日志

#### 4. iOS 特殊限制

##### 文件大小限制
- iOS Safari 对单个文件上传有内存限制（通常 ~100MB）
- 超大文件可能导致浏览器崩溃

**解决：**
- 压缩视频文件
- 分段上传（需要修改代码）

##### 文件类型限制
- 某些文件类型可能被 iOS 限制
- Live Photos 可能无法正确上传

**解决：**
- 转换文件格式
- 使用标准格式（MP4, JPG, PNG）

##### 后台限制
- iOS 切换到后台时，上传可能暂停
- 锁屏会中断上传

**解决：**
- 保持应用在前台
- 提示用户不要锁屏

#### 5. 测试建议

**测试顺序：**
1. 先测试小文件（< 1MB）
2. 再测试中等文件（1-10MB）
3. 最后测试大文件（> 10MB）

**测试文件类型：**
1. 图片（JPG, PNG）
2. 文档（PDF, TXT）
3. 视频（MP4）

**测试网络：**
1. 同一 WiFi 网络
2. 不同 WiFi 网络
3. 移动数据（如果支持）

#### 6. 临时解决方案

如果上传仍然失败，可以尝试：

**方案 A：使用 Socket.IO 传输（小文件）**
- 适用于 < 10MB 的文件
- 通过 WebSocket 传输，更稳定

**方案 B：分块上传**
- 将大文件分成多个小块
- 逐块上传，更可靠

**方案 C：使用第三方服务**
- 上传到云存储（如 iCloud, Google Drive）
- 桌面端从云端下载

### 修改内容（已完成）：

1. ✅ 添加详细的日志输出
2. ✅ 添加超时设置（5分钟）
3. ✅ 添加所有错误事件监听（timeout, error, abort）
4. ✅ 明确指定文件名（FormData.append 第三个参数）
5. ✅ 添加上传状态检查

### 下一步：

1. 在 iOS 设备上测试
2. 查看控制台日志
3. 根据日志确定具体问题
4. 应用相应的解决方案
