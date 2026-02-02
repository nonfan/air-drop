/**
 * 文件传输管理 Hook
 */
import { useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { setStorageItem, STORAGE_KEYS } from '../utils';
import type { FileItem } from '../types';

interface UseFileTransferOptions {
  socket: Socket | null;
  selectedDevice: string | null;
  onSaveLastDevice: (deviceId: string) => void;
}

export function useFileTransfer(options: UseFileTransferOptions) {
  const { socket, selectedDevice, onSaveLastDevice } = options;

  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [isSending, setIsSending] = useState(false);

  // 选择文件
  const selectFiles = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files) {
        const newFiles = Array.from(target.files).map(file => ({
          name: file.name,
          size: file.size,
          file
        }));
        setSelectedFiles(prev => [...prev, ...newFiles]);
      }
    };
    input.click();
  }, []);

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
    if (!socket || !deviceId || selectedFiles.length === 0) return;

    if (!socket.connected) {
      console.error('Socket.IO not connected');
      return;
    }

    setIsSending(true);

    try {
      for (const fileItem of selectedFiles) {
        const formData = new FormData();
        formData.append('file', fileItem.file);
        formData.append('targetId', deviceId);
        formData.append('fileName', fileItem.name);

        const uploadUrl = `${window.location.origin}/api/upload`;
        console.log('Uploading to:', uploadUrl, 'targetId:', deviceId);

        const response = await fetch(uploadUrl, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Upload failed:', response.status, errorText);
          throw new Error('Upload failed');
        }
      }

      onSaveLastDevice(deviceId);
      setSelectedFiles([]);
      setIsSending(false);
    } catch (error) {
      console.error('Send error:', error);
      setIsSending(false);
    }
  }, [socket, selectedDevice, selectedFiles, onSaveLastDevice]);

  return {
    selectedFiles,
    isSending,
    setSelectedFiles,
    selectFiles,
    handleDrop,
    sendFiles
  };
}
