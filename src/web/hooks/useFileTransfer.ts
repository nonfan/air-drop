/**
 * 文件传输管理 Hook
 */
import { useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { setStorageItem, STORAGE_KEYS } from '../utils';
import { generateFileThumbnail } from '../utils/videoThumbnail';
import type { FileItem } from '../types';

interface UseFileTransferOptions {
  socket: Socket | null;
  selectedDevice: string | null;
  onSaveLastDevice: (deviceId: string) => void;
  onProgressUpdate?: (progress: { percent: number; currentFile: string; totalSize: number; sentSize: number }) => void;
  onComplete?: () => void;
  onError?: () => void;
}

export function useFileTransfer(options: UseFileTransferOptions) {
  const { socket, selectedDevice, onSaveLastDevice, onProgressUpdate, onComplete, onError } = options;

  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [isSending, setIsSending] = useState(false);

  // 清理隐藏的 input 元素的辅助函数
  const cleanupHiddenInput = useCallback(() => {
    const hiddenInput = (window as any).__fileInput;
    if (hiddenInput && hiddenInput.parentNode) {
      hiddenInput.parentNode.removeChild(hiddenInput);
      delete (window as any).__fileInput;
      console.log('[FileSelect] Cleaned up hidden input element');
    }
  }, []);

  // 包装 setSelectedFiles，当清空文件时也清理 input
  const setSelectedFilesWithCleanup = useCallback((filesOrUpdater: FileItem[] | ((prev: FileItem[]) => FileItem[])) => {
    setSelectedFiles(prev => {
      const newFiles = typeof filesOrUpdater === 'function' ? filesOrUpdater(prev) : filesOrUpdater;
      
      // 如果文件列表被清空，清理隐藏的 input
      if (newFiles.length === 0 && prev.length > 0) {
        cleanupHiddenInput();
      }
      
      return newFiles;
    });
  }, [cleanupHiddenInput]);

  // 选择文件
  const selectFiles = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    
    // 检测是否为移动设备
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // 移动端优化：不添加 capture 属性，让用户可以选择相册或拍照
    // 这样可以避免 iOS 立即加载大视频的问题
    if (!isMobile) {
      input.accept = '*/*';
    }
    
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files) {
        // 立即获取文件元数据（不读取内容）
        // File 对象是轻量引用，只包含元数据（name, size, type, lastModified）
        // 实际文件内容只在读取时（如 FormData.append）才会加载
        const filesArray = Array.from(target.files);
        
        // 立即添加文件到列表（不等待缩略图）
        const newFiles = filesArray.map(file => {
          console.log(`[FileSelect] File metadata: ${file.name}, ${file.size} bytes, ${file.type}`);
          return {
            name: file.name,
            size: file.size,
            file, // 保存 File 引用，不读取内容
            thumbnail: undefined // 缩略图稍后异步生成
          };
        });
        
        setSelectedFilesWithCleanup(prev => [...prev, ...newFiles]);
        
        // 异步生成缩略图（不阻塞 UI）
        filesArray.forEach(async (file, index) => {
          try {
            const thumbnail = await generateFileThumbnail(file, 200);
            if (thumbnail) {
              console.log(`[FileSelect] Thumbnail generated for: ${file.name}`);
              // 更新对应文件的缩略图
              setSelectedFilesWithCleanup(prev => 
                prev.map(item => 
                  item.file === file ? { ...item, thumbnail } : item
                )
              );
            }
          } catch (error) {
            console.error(`[FileSelect] Failed to generate thumbnail for ${file.name}:`, error);
          }
        });
      }
      
      // iOS Safari 修复：保持 input 元素在 DOM 中，防止 File 对象失效
      // 将 input 隐藏但不移除，直到文件发送完成
      input.style.display = 'none';
      document.body.appendChild(input);
      
      // 保存 input 引用，以便后续清理
      (window as any).__fileInput = input;
    };
    
    input.click();
  }, [setSelectedFilesWithCleanup]);

  // 处理文件拖放
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).map(file => ({
      name: file.name,
      size: file.size,
      file
    }));
    if (droppedFiles.length) {
      setSelectedFiles(prev => [...prev, ...droppedFiles]);
    }
  }, []);

  // 发送文件
  const sendFiles = useCallback(async (targetDeviceId?: string) => {
    const deviceId = targetDeviceId || selectedDevice;
    if (!socket || !deviceId || selectedFiles.length === 0) {
      console.error('[SendFiles] Missing requirements:', {
        hasSocket: !!socket,
        hasDevice: !!deviceId,
        filesCount: selectedFiles.length
      });
      return;
    }

    if (!socket.connected) {
      console.error('[SendFiles] Socket.IO not connected');
      return;
    }

    console.log('[SendFiles] Starting upload:', {
      deviceId,
      filesCount: selectedFiles.length,
      files: selectedFiles.map(f => ({ name: f.name, size: f.size, type: f.file.type }))
    });

    setIsSending(true);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const fileItem = selectedFiles[i];
        console.log(`[SendFiles] Uploading file ${i + 1}/${selectedFiles.length}:`, fileItem.name);
        
        const formData = new FormData();
        formData.append('file', fileItem.file, fileItem.name); // 明确指定文件名
        formData.append('targetId', deviceId);
        formData.append('fileName', fileItem.name);

        const uploadUrl = `${window.location.origin}/api/upload`;
        console.log('[SendFiles] Upload URL:', uploadUrl);

        // 使用 XMLHttpRequest 以支持上传进度监控
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          // 添加超时设置（iOS 可能需要）
          xhr.timeout = 300000; // 5分钟超时
          
          xhr.addEventListener('timeout', () => {
            console.error('[SendFiles] Upload timeout');
            reject(new Error('Upload timeout'));
          });
          
          // 监听上传进度
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              // iOS 修复：限制进度最大值为 99%，避免闪烁到 100%
              // 只有在真正完成时才显示 100%
              const rawPercent = Math.round((e.loaded / e.total) * 100);
              const percent = Math.min(rawPercent, 99); // 限制最大 99%
              
              console.log(`[Upload] Progress: ${fileItem.name} ${percent}% (${e.loaded}/${e.total})`);
              
              // 更新本地进度（显示在移动端 UI）
              if (onProgressUpdate) {
                onProgressUpdate({
                  percent,
                  currentFile: fileItem.name,
                  totalSize: e.total,
                  sentSize: e.loaded
                });
              }
              
              // 同步进度给桌面端（通过 Socket.IO）
              if (socket && socket.connected) {
                socket.emit('upload-progress-sync', {
                  fileName: fileItem.name,
                  percent,
                  sentSize: e.loaded,
                  totalSize: e.total
                });
              }
            }
          });
          
          xhr.addEventListener('load', () => {
            console.log('[SendFiles] Upload complete, status:', xhr.status);
            
            if (xhr.status >= 200 && xhr.status < 300) {
              // 上传成功，显示 100% 进度
              console.log('[SendFiles] Showing 100% completion');
              if (onProgressUpdate) {
                onProgressUpdate({
                  percent: 100,
                  currentFile: fileItem.name,
                  totalSize: fileItem.size,
                  sentSize: fileItem.size
                });
              }
              
              // 同步 100% 给桌面端
              if (socket && socket.connected) {
                socket.emit('upload-progress-sync', {
                  fileName: fileItem.name,
                  percent: 100,
                  sentSize: fileItem.size,
                  totalSize: fileItem.size
                });
              }
              
              // 延迟 800ms 让用户看到 100% 完成状态
              setTimeout(() => {
                resolve();
              }, 800);
            } else {
              console.error('[SendFiles] Upload failed:', xhr.status, xhr.responseText);
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          });
          
          xhr.addEventListener('error', (e) => {
            console.error('[SendFiles] Upload error:', e);
            reject(new Error('Upload error'));
          });
          
          xhr.addEventListener('abort', () => {
            console.error('[SendFiles] Upload aborted');
            reject(new Error('Upload aborted'));
          });
          
          xhr.open('POST', uploadUrl);
          
          // iOS Safari 可能需要这些头部
          // 注意：不要手动设置 Content-Type，让浏览器自动设置（包含 boundary）
          
          console.log('[SendFiles] Sending FormData...');
          xhr.send(formData);
        });
      }

      console.log('[SendFiles] All files uploaded successfully');
      onSaveLastDevice(deviceId);
      setSelectedFiles([]);
      setIsSending(false);
      
      // iOS Safari 修复：清理隐藏的 input 元素
      cleanupHiddenInput();
      
      // 通知完成
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('[SendFiles] Send error:', error);
      setIsSending(false);
      
      // iOS Safari 修复：清理隐藏的 input 元素（错误情况）
      cleanupHiddenInput();
      
      // 通知错误
      if (onError) {
        onError();
      }
    }
  }, [socket, selectedDevice, selectedFiles, onSaveLastDevice, onProgressUpdate, onComplete, onError, cleanupHiddenInput]);

  return {
    selectedFiles,
    isSending,
    setSelectedFiles: setSelectedFilesWithCleanup,
    selectFiles,
    handleDrop,
    sendFiles
  };
}
