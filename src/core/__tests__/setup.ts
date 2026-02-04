/**
 * 测试环境设置
 */

// Mock IndexedDB for Node.js environment
if (typeof indexedDB === 'undefined') {
  global.indexedDB = require('fake-indexeddb');
  global.IDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');
}

// Mock WebSocket
if (typeof WebSocket === 'undefined') {
  global.WebSocket = require('ws');
}

// Mock fetch
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

// Mock localStorage
if (typeof localStorage === 'undefined') {
  global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  } as any;
}

// Setup test timeout
jest.setTimeout(10000);
