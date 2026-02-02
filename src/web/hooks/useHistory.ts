/**
 * 历史记录管理 Hook
 */
import { useState, useCallback, useEffect } from 'react';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../utils';
import type { HistoryItem } from '../types';

// 默认测试数据
const DEFAULT_HISTORY: HistoryItem[] = [
  {
    id: 'history-1',
    type: 'file',
    fileName: '项目文档.pdf',
    fileSize: 2048576,
    filePath: '/downloads/项目文档.pdf',
    timestamp: Date.now() - 300000,
    status: 'success',
    direction: 'received',
    from: '我的 MacBook Pro'
  },
  {
    id: 'history-2',
    type: 'text',
    content: '这是一段测试文本消息，用于预览UI效果',
    timestamp: Date.now() - 600000,
    status: 'success',
    direction: 'received',
    from: 'iPhone 15 Pro'
  },
  {
    id: 'history-3',
    type: 'file',
    fileName: '照片_2024.jpg',
    fileSize: 5242880,
    filePath: '/downloads/照片_2024.jpg',
    timestamp: Date.now() - 900000,
    status: 'success',
    direction: 'received',
    from: 'Windows 台式机'
  },
  {
    id: 'history-4',
    type: 'text',
    content: '会议时间改到下午3点，请准时参加',
    timestamp: Date.now() - 1200000,
    status: 'success',
    direction: 'sent',
    from: '我的设备'
  },
  {
    id: 'history-5',
    type: 'file',
    fileName: '设计稿_v2.sketch',
    fileSize: 15728640,
    filePath: '/downloads/设计稿_v2.sketch',
    timestamp: Date.now() - 1500000,
    status: 'success',
    direction: 'received',
    from: 'MacBook Air'
  },
  {
    id: 'history-6',
    type: 'file',
    fileName: '视频教程.mp4',
    fileSize: 52428800,
    filePath: '/downloads/视频教程.mp4',
    timestamp: Date.now() - 1800000,
    status: 'success',
    direction: 'received',
    from: 'iPad Pro'
  },
  {
    id: 'history-7',
    type: 'text',
    content: 'https://github.com/example/project - 这是项目仓库地址',
    timestamp: Date.now() - 2100000,
    status: 'success',
    direction: 'received',
    from: 'Android 手机'
  },
  {
    id: 'history-8',
    type: 'file',
    fileName: '数据报表.xlsx',
    fileSize: 1048576,
    filePath: '/downloads/数据报表.xlsx',
    timestamp: Date.now() - 2400000,
    status: 'success',
    direction: 'sent',
    from: '我的设备'
  },
  {
    id: 'history-9',
    type: 'text',
    content: '今天的任务已经完成，明天继续',
    timestamp: Date.now() - 2700000,
    status: 'success',
    direction: 'sent',
    from: '我的设备'
  },
  {
    id: 'history-10',
    type: 'file',
    fileName: '代码压缩包.zip',
    fileSize: 10485760,
    filePath: '/downloads/代码压缩包.zip',
    timestamp: Date.now() - 3000000,
    status: 'success',
    direction: 'received',
    from: 'Linux 服务器'
  },
  {
    id: 'history-11',
    type: 'file',
    fileName: '产品原型图.fig',
    fileSize: 8388608,
    filePath: '/downloads/产品原型图.fig',
    timestamp: Date.now() - 3300000,
    status: 'success',
    direction: 'received',
    from: 'MacBook Pro'
  },
  {
    id: 'history-12',
    type: 'text',
    content: '记得明天带充电器和数据线',
    timestamp: Date.now() - 3600000,
    status: 'success',
    direction: 'received',
    from: 'iPhone 14'
  },
  {
    id: 'history-13',
    type: 'file',
    fileName: '会议录音.m4a',
    fileSize: 25165824,
    filePath: '/downloads/会议录音.m4a',
    timestamp: Date.now() - 3900000,
    status: 'success',
    direction: 'received',
    from: 'iPad Mini'
  }
];

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const savedHistory = getStorageItem<HistoryItem[]>(STORAGE_KEYS.HISTORY, []);
    return savedHistory.length > 0 ? savedHistory : DEFAULT_HISTORY;
  });

  // 添加历史记录项
  const addHistoryItem = useCallback((item: HistoryItem) => {
    setHistory(prev => {
      // 避免重复添加
      if (prev.find(h => h.id === item.id)) return prev;
      const newHistory = [item, ...prev];
      setStorageItem(STORAGE_KEYS.HISTORY, newHistory);
      return newHistory;
    });
  }, []);

  // 清空历史记录
  const clearHistory = useCallback(() => {
    setHistory([]);
    setStorageItem(STORAGE_KEYS.HISTORY, []);
  }, []);

  // 保存历史记录
  const saveHistory = useCallback((newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    setStorageItem(STORAGE_KEYS.HISTORY, newHistory);
  }, []);

  return {
    history,
    addHistoryItem,
    clearHistory,
    saveHistory
  };
}
