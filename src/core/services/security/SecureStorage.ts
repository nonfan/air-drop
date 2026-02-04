/**
 * 安全存储服务
 * 提供密钥的加密存储和检索
 */

import { SessionKey } from './CryptoService';

export class SecureStorage {
  private readonly SALT = 'airdrop-security-salt-v1';
  private readonly ITERATIONS = 100000;

  /**
   * 存储私钥（加密）
   */
  async storePrivateKey(privateKey: string, password: string): Promise<void> {
    // 派生加密密钥
    const derivedKey = await this.deriveKey(password);
    
    // 加密私钥
    const encrypted = await this.encrypt(privateKey, derivedKey);
    
    // 存储到 localStorage（生产环境应使用 IndexedDB）
    localStorage.setItem('encrypted_private_key', encrypted);
  }

  /**
   * 读取私钥（解密）
   */
  async retrievePrivateKey(password: string): Promise<string> {
    const encrypted = localStorage.getItem('encrypted_private_key');
    if (!encrypted) {
      throw new Error('Private key not found');
    }
    
    // 派生解密密钥
    const derivedKey = await this.deriveKey(password);
    
    // 解密私钥
    return await this.decrypt(encrypted, derivedKey);
  }

  /**
   * 存储会话密钥
   */
  async storeSessionKey(deviceId: string, sessionKey: SessionKey): Promise<void> {
    const key = `session_key_${deviceId}`;
    const data = {
      key: Array.from(sessionKey.key),
      iv: Array.from(sessionKey.iv),
      expiresAt: sessionKey.expiresAt
    };
    
    localStorage.setItem(key, JSON.stringify(data));
  }

  /**
   * 读取会话密钥
   */
  async retrieveSessionKey(deviceId: string): Promise<SessionKey | null> {
    const key = `session_key_${deviceId}`;
    const data = localStorage.getItem(key);
    
    if (!data) return null;
    
    try {
      const parsed = JSON.parse(data);
      
      // 检查是否过期
      if (Date.now() > parsed.expiresAt) {
        localStorage.removeItem(key);
        return null;
      }
      
      return {
        key: new Uint8Array(parsed.key),
        iv: new Uint8Array(parsed.iv),
        expiresAt: parsed.expiresAt
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 删除会话密钥
   */
  async removeSessionKey(deviceId: string): Promise<void> {
    const key = `session_key_${deviceId}`;
    localStorage.removeItem(key);
  }

  /**
   * 清除所有密钥
   */
  async clearAllKeys(): Promise<void> {
    // 清除私钥
    localStorage.removeItem('encrypted_private_key');
    
    // 清除所有会话密钥
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('session_key_')) {
        localStorage.removeItem(key);
      }
    }
  }

  /**
   * 检查私钥是否存在
   */
  hasPrivateKey(): boolean {
    return localStorage.getItem('encrypted_private_key') !== null;
  }

  /**
   * 验证密码
   */
  async verifyPassword(password: string): Promise<boolean> {
    try {
      await this.retrievePrivateKey(password);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 更改密码
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    // 使用旧密码解密私钥
    const privateKey = await this.retrievePrivateKey(oldPassword);
    
    // 使用新密码加密私钥
    await this.storePrivateKey(privateKey, newPassword);
  }

  /**
   * 清理过期的会话密钥
   */
  async cleanupExpiredSessionKeys(): Promise<number> {
    const keys = Object.keys(localStorage);
    let cleaned = 0;
    
    for (const key of keys) {
      if (key.startsWith('session_key_')) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Date.now() > parsed.expiresAt) {
              localStorage.removeItem(key);
              cleaned++;
            }
          } catch {
            // 无效数据，删除
            localStorage.removeItem(key);
            cleaned++;
          }
        }
      }
    }
    
    return cleaned;
  }

  /**
   * 获取存储统计
   */
  getStorageStats(): {
    hasPrivateKey: boolean;
    sessionKeyCount: number;
    totalSize: number;
  } {
    const keys = Object.keys(localStorage);
    let sessionKeyCount = 0;
    let totalSize = 0;
    
    for (const key of keys) {
      if (key.startsWith('session_key_')) {
        sessionKeyCount++;
      }
      const value = localStorage.getItem(key);
      if (value) {
        totalSize += key.length + value.length;
      }
    }
    
    return {
      hasPrivateKey: this.hasPrivateKey(),
      sessionKeyCount,
      totalSize
    };
  }

  /**
   * 密钥派生（PBKDF2）
   */
  private async deriveKey(password: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(this.SALT),
        iterations: this.ITERATIONS,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * 加密数据
   */
  private async encrypt(data: string, key: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128
      },
      key,
      encoder.encode(data)
    );
    
    // 组合 IV 和加密数据
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // 转换为 Base64
    return btoa(String.fromCharCode(...combined));
  }

  /**
   * 解密数据
   */
  private async decrypt(encryptedData: string, key: CryptoKey): Promise<string> {
    // 从 Base64 解码
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // 分离 IV 和加密数据
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128
      },
      key,
      data
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }
}
