import { useState, useEffect, useCallback } from 'react';

/**
 * LocalStorage Hook
 * 自动同步状态到 localStorage
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // 从 localStorage 读取初始值
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  /**
   * 设置值并保存到 localStorage
   */
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  /**
   * 删除值
   */
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

/**
 * 批量 LocalStorage Hook
 */
export function useLocalStorageMultiple<T extends Record<string, any>>(
  prefix: string,
  initialValues: T
): [T, (updates: Partial<T>) => void, () => void] {
  const [values, setValues] = useState<T>(() => {
    const stored: Partial<T> = {};
    for (const key in initialValues) {
      try {
        const item = window.localStorage.getItem(`${prefix}_${key}`);
        if (item) {
          stored[key] = JSON.parse(item);
        }
      } catch (error) {
        console.error(`Error reading localStorage key "${prefix}_${key}":`, error);
      }
    }
    return { ...initialValues, ...stored };
  });

  /**
   * 更新多个值
   */
  const updateValues = useCallback((updates: Partial<T>) => {
    setValues(prev => {
      const newValues = { ...prev, ...updates };
      // 保存到 localStorage
      for (const key in updates) {
        try {
          window.localStorage.setItem(
            `${prefix}_${key}`,
            JSON.stringify(newValues[key])
          );
        } catch (error) {
          console.error(`Error setting localStorage key "${prefix}_${key}":`, error);
        }
      }
      return newValues;
    });
  }, [prefix]);

  /**
   * 清除所有值
   */
  const clearAll = useCallback(() => {
    for (const key in initialValues) {
      try {
        window.localStorage.removeItem(`${prefix}_${key}`);
      } catch (error) {
        console.error(`Error removing localStorage key "${prefix}_${key}":`, error);
      }
    }
    setValues(initialValues);
  }, [prefix, initialValues]);

  return [values, updateValues, clearAll];
}
