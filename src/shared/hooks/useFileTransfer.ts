import { useState, useCallback } from 'react';

export interface FileItem {
  name: string;
  size: number;
  file: File;
}

export interface TransferProgress {
  percent: number;
  currentFile: string;
  totalSize: number;
  sentSize: number;
}

/**
 * 文件传输 Hook
 */
export function useFileTransfer() {
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<TransferProgress | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<TransferProgress | null>(null);

  /**
   * 添加文件
   */
  const addFiles = useCallback((files: File[]) => {
    const newFiles = files.map(file => ({
      name: file.name,
      size: file.size,
      file
    }));
    setSelectedFiles(prev => [...prev, ...newFiles]);
  }, []);

  /**
   * 移除文件
   */
  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * 清空文件列表
   */
  const clearFiles = useCallback(() => {
    setSelectedFiles([]);
  }, []);

  /**
   * 开始发送
   */
  const startSending = useCallback(() => {
    setIsSending(true);
    setSendProgress({ percent: 0, currentFile: '', totalSize: 0, sentSize: 0 });
  }, []);

  /**
   * 完成发送
   */
  const completeSending = useCallback(() => {
    setIsSending(false);
    setSendProgress(null);
    setSelectedFiles([]);
  }, []);

  /**
   * 发送失败
   */
  const failSending = useCallback(() => {
    setIsSending(false);
    setSendProgress(null);
  }, []);

  /**
   * 更新发送进度
   */
  const updateSendProgress = useCallback((progress: TransferProgress) => {
    setSendProgress(progress);
  }, []);

  /**
   * 更新下载进度
   */
  const updateDownloadProgress = useCallback((progress: TransferProgress) => {
    setDownloadProgress(progress);
  }, []);

  /**
   * 清除下载进度
   */
  const clearDownloadProgress = useCallback(() => {
    setDownloadProgress(null);
  }, []);

  /**
   * 计算总大小
   */
  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);

  return {
    selectedFiles,
    isSending,
    sendProgress,
    downloadProgress,
    totalSize,
    addFiles,
    removeFile,
    clearFiles,
    startSending,
    completeSending,
    failSending,
    updateSendProgress,
    updateDownloadProgress,
    clearDownloadProgress
  };
}
