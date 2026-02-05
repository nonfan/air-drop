/**
 * 历史记录管理 Hook
 */
import { useState, useCallback, useEffect } from 'react';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../utils';
import type { HistoryItem } from '../types';

// 默认测试数据（生产环境为空）
const DEFAULT_HISTORY: HistoryItem[] = [];

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

  // 更新历史记录项
  const updateHistoryItem = useCallback((id: string, updates: Partial<HistoryItem>) => {
    setHistory(prev => {
      const newHistory = prev.map(item => 
        item.id === id ? { ...item, ...updates } : item
      );
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
    updateHistoryItem,
    clearHistory,
    saveHistory
  };
}
