/**
 * 集成测试环境设置
 */

// 继承单元测试的设置
import '../setup';

// 集成测试特定的配置
jest.setTimeout(30000); // 集成测试需要更长的超时时间

// Mock 完整的浏览器环境
if (typeof window === 'undefined') {
  (global as any).window = {
    location: {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000'
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };
}

// Mock File API
if (typeof File === 'undefined') {
  (global as any).File = class MockFile extends Blob {
    name: string;
    lastModified: number;

    constructor(bits: any[], name: string, options?: any) {
      super(bits, options);
      this.name = name;
      this.lastModified = Date.now();
    }
  };
}

// Mock FormData
if (typeof FormData === 'undefined') {
  (global as any).FormData = class MockFormData {
    private data: Map<string, any> = new Map();

    append(key: string, value: any) {
      this.data.set(key, value);
    }

    get(key: string) {
      return this.data.get(key);
    }

    has(key: string) {
      return this.data.has(key);
    }
  };
}

// 清理函数
export const cleanupIntegrationTest = async () => {
  // 清理 IndexedDB
  if (typeof indexedDB !== 'undefined') {
    const databases = ['airdrop-transfers'];
    for (const dbName of databases) {
      try {
        indexedDB.deleteDatabase(dbName);
      } catch (error) {
        // Ignore errors
      }
    }
  }

  // 清理 localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
};
