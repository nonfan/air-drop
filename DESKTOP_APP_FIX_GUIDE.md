# 桌面端 App.tsx 修复指南

## 问题诊断

当前 `src/renderer/App.tsx` 文件有以下问题：

1. **第 299 行**: 多余的闭合大括号 `}`，导致 useEffect 提前结束
2. **第 301-310 行**: `if` 语句在 useEffect 外面
3. **未使用的状态**: `isSending`, `isDownloading`, `openedId`, `missingFiles`
4. **未使用的导入**: `Footer`, `DownloadProgressCard`, `formatTime`

## 修复步骤

### 步骤 1: 删除未使用的导入

在文件顶部，修改导入语句：

```typescript
// 删除这些导入
import { Footer, DownloadProgressCard } from './components';
import { formatTime } from './utils';

// 改为
import {
  Titlebar,
  Sidebar,
  DeviceList,
  FileDropZone,
  TextInput,
  HistoryList,
  QRModal,
  SettingsPage
} from './components';
import { formatSize } from './utils';
```

### 步骤 2: 删除未使用的状态

删除以下状态声明（约第 36-40 行）：

```typescript
// 删除这些行
const [isSending, setIsSending] = useState(false);
const [isDownloading, setIsDownloading] = useState(false);
const [openedId, setOpenedId] = useState<string | null>(null);
const [missingFiles, setMissingFiles] = useState<Set<string>>(new Set());
```

### 步骤 3: 修复 useEffect 中的事件监听（约第 270-320 行）

找到这段代码：

```typescript
    });
  }

    // 移动端上传进度（如果事件存在）
    if (window.windrop.onMobileUploadProgress) {
    window.windrop.onMobileUploadProgress((progress: any) => {
```

替换为：

```typescript
    });

    // 移动端上传进度
    window.windrop.onMobileUploadProgress?.((progress: any) => {
      console.log(`[Desktop] Mobile upload progress: ${progress.fileName} ${progress.percent}%`);
      setReceiveProgress({
        percent: progress.percent,
        currentFile: progress.fileName,
        totalSize: progress.totalSize,
        sentSize: progress.sentSize
      });

      const matchingRecord = transferHistory.find(record =>
        record.fileName === progress.fileName &&
        record.type === 'received'
      );

      if (matchingRecord) {
        downloadProgressMap.set(matchingRecord.id, {
          percent: progress.percent,
          receivedSize: progress.sentSize,
          totalSize: progress.totalSize
        });
        setTransferHistory(prev => [...prev]);
      }
    });

    window.windrop.onUpdateAvailable((info) => {
```

### 步骤 4: 修复 handleSend 函数（约第 350-370 行）

找到 `handleSend` 函数，删除 `setIsSending` 相关代码：

```typescript
const handleSend = async (targetDeviceId?: string) => {
  const deviceId = targetDeviceId || selectedDevice;
  if (!deviceId || !selectedFiles.length) return;

  const device = devices.find(d => d.id === deviceId);
  if (!device) return;

  if (device.type === 'mobile') {
    for (const f of selectedFiles) {
      const id = await window.windrop.shareFileWeb(f.path, device.id);
      if (id) setSharedFiles(prev => [...prev, { id, ...f, targetId: device.id }]);
    }
    setSelectedFiles([]);
  } else {
    // 删除 setIsSending(true);
    try {
      await window.windrop.sendFiles(deviceId, selectedFiles.map(f => f.path));
    } catch (error) {
      console.error('Send files error:', error);
      // 删除 setIsSending(false);
    }
  }
};
```

### 步骤 5: 修复 FileDropZone props（约第 450 行）

找到 `<FileDropZone` 组件，删除进度相关的 props：

```typescript
<FileDropZone
  isDragging={isDragging}
  selectedFiles={selectedFiles}
  sharedFiles={sharedFiles}
  // 删除以下 props:
  // isSending={isSending}
  // isDownloading={isDownloading}
  // sendProgress={sendProgress}
  // receiveProgress={receiveProgress}
  // downloadProgressMap={downloadProgressMap}
  // transferHistory={transferHistory}
  devices={devices}
  onSelectFiles={handleSelectFiles}
  onRemoveFile={(i) => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
  onClearFiles={() => setSelectedFiles([])}
  onRemoveSharedFile={(id) => {
    window.windrop.unshareFileWeb(id);
    setSharedFiles(prev => prev.filter(x => x.id !== id));
  }}
  formatSize={formatSize}
/>
```

### 步骤 6: 删除 Footer 组件（约第 550 行）

找到并删除整个 Footer 组件：

```typescript
// 删除这段代码
{view === 'transfer' && (
  <Footer
    deviceName={settings?.deviceName}
    version={appVersion || '1.0.0'}
    variant="detailed"
  />
)}
```

### 步骤 7: 删除 DownloadProgressCard 组件（约第 630 行）

找到并删除整个 DownloadProgressCard 组件：

```typescript
// 删除这段代码
{isDownloading && receiveProgress && receiveProgress.totalSize && receiveProgress.totalSize > 0 && (
  <DownloadProgressCard
    fileName={receiveProgress.currentFile || '未知文件'}
    fileSize={receiveProgress.totalSize}
    progress={receiveProgress.percent}
    receivedSize={receiveProgress.sentSize}
  />
)}
```

### 步骤 8: 修复 onDownloadFile 回调（约第 530 行）

找到 `onDownloadFile` 回调，删除 `openedId` 和 `missingFiles` 相关代码：

```typescript
onDownloadFile={async (filePath, _fileName, itemId) => {
  try {
    setDownloadingId(itemId);
    const success = await window.windrop.showFileInFolder(filePath);
    setDownloadingId(null);
    if (success) {
      setDownloadedIds(prev => new Set(prev).add(itemId));
      // 删除 setOpenedId 和 setMissingFiles 相关代码
    } else {
      setDownloadFailedIds(prev => new Set(prev).add(itemId));
      setDownloadFailedId(itemId);
      setTimeout(() => setDownloadFailedId(null), 2000);
      // 删除 setMissingFiles 相关代码
      setToast('文件已被删除或移动');
      setTimeout(() => setToast(null), 2000);
    }
  } catch {
    setDownloadingId(null);
    setDownloadFailedIds(prev => new Set(prev).add(itemId));
    setDownloadFailedId(itemId);
    setTimeout(() => setDownloadFailedId(null), 2000);
    // 删除 setMissingFiles 相关代码
    setToast('文件已被删除或移动');
    setTimeout(() => setToast(null), 2000);
  }
}}
```

## 快速修复方法

如果手动修复太复杂，可以使用以下方法：

### 方法 1: 使用 Git 恢复

```bash
# 查看文件的 git 历史
git log --oneline src/renderer/App.tsx

# 恢复到之前的版本
git checkout <commit-hash> -- src/renderer/App.tsx

# 然后重新应用必要的修改
```

### 方法 2: 使用备份

```bash
# 如果有备份文件
copy src\renderer\App.tsx.backup src\renderer\App.tsx
```

### 方法 3: 重新生成

删除当前文件，让我重新生成一个干净的版本。

## 验证修复

修复后，运行以下命令验证：

```bash
# 检查 TypeScript 错误
npm run build

# 或者启动开发服务器
npm run dev
```

应该没有 TypeScript 错误。

## 测试建议

1. **测试文件接收**: 从移动端发送文件到桌面端，验证进度在 History 中显示
2. **测试文件发送**: 从桌面端发送文件到移动端，验证正常
3. **测试进度显示**: 验证 History 列表中的进度条正常显示

## 需要帮助？

如果手动修复遇到问题，可以：
1. 提供当前的错误信息
2. 或者让我重新生成整个文件
