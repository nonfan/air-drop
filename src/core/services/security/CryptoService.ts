/**
 * 加密服务
 * 提供密钥生成、文件加密/解密等功能
 */

export interface KeyPair {
  publicKey: string;   // RSA 公钥（PEM格式）
  privateKey: string;  // RSA 私钥（PEM格式）
}

export interface SessionKey {
  key: Uint8Array;     // AES-256 密钥
  iv: Uint8Array;      // 初始化向量
  expiresAt: number;   // 过期时间
}

export class CryptoService {
  /**
   * 生成 RSA 密钥对
   */
  async generateKeyPair(): Promise<KeyPair> {
    // 检查 Web Crypto API 是否可用
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      throw new Error('Web Crypto API 不可用。请确保在 HTTPS 环境或 localhost 下运行。');
    }

    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['encrypt', 'decrypt']
    );
    
    const publicKey = await this.exportPublicKey(keyPair.publicKey);
    const privateKey = await this.exportPrivateKey(keyPair.privateKey);
    
    return { publicKey, privateKey };
  }

  /**
   * 生成会话密钥
   */
  async generateSessionKey(): Promise<SessionKey> {
    const key = crypto.getRandomValues(new Uint8Array(32)); // 256 bits
    const iv = crypto.getRandomValues(new Uint8Array(12));  // 96 bits for GCM
    
    return {
      key,
      iv,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24小时
    };
  }

  /**
   * 加密文件
   */
  async encryptFile(file: File, sessionKey: SessionKey): Promise<Blob> {
    const key = await crypto.subtle.importKey(
      'raw',
      sessionKey.key.buffer as ArrayBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    const fileData = await file.arrayBuffer();
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: sessionKey.iv.buffer as ArrayBuffer,
        tagLength: 128
      },
      key,
      fileData
    );
    
    return new Blob([encrypted]);
  }

  /**
   * 解密文件
   */
  async decryptFile(encryptedBlob: Blob, sessionKey: SessionKey): Promise<Blob> {
    const key = await crypto.subtle.importKey(
      'raw',
      sessionKey.key.buffer as ArrayBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const encryptedData = await encryptedBlob.arrayBuffer();
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: sessionKey.iv.buffer as ArrayBuffer,
        tagLength: 128
      },
      key,
      encryptedData
    );
    
    return new Blob([decrypted]);
  }

  /**
   * 导出公钥为 PEM 格式
   */
  private async exportPublicKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('spki', key);
    const exportedAsString = String.fromCharCode(...new Uint8Array(exported));
    const exportedAsBase64 = btoa(exportedAsString);
    return `-----BEGIN PUBLIC KEY-----\n${exportedAsBase64}\n-----END PUBLIC KEY-----`;
  }

  /**
   * 导出私钥为 PEM 格式
   */
  private async exportPrivateKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('pkcs8', key);
    const exportedAsString = String.fromCharCode(...new Uint8Array(exported));
    const exportedAsBase64 = btoa(exportedAsString);
    return `-----BEGIN PRIVATE KEY-----\n${exportedAsBase64}\n-----END PRIVATE KEY-----`;
  }

  /**
   * 导入公钥
   */
  async importPublicKey(pem: string): Promise<CryptoKey> {
    const pemHeader = '-----BEGIN PUBLIC KEY-----';
    const pemFooter = '-----END PUBLIC KEY-----';
    const pemContents = pem.substring(
      pemHeader.length,
      pem.length - pemFooter.length
    ).trim();
    
    const binaryDerString = atob(pemContents);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
      binaryDer[i] = binaryDerString.charCodeAt(i);
    }
    
    return await crypto.subtle.importKey(
      'spki',
      binaryDer.buffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      true,
      ['encrypt']
    );
  }

  /**
   * 导入私钥
   */
  async importPrivateKey(pem: string): Promise<CryptoKey> {
    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';
    const pemContents = pem.substring(
      pemHeader.length,
      pem.length - pemFooter.length
    ).trim();
    
    const binaryDerString = atob(pemContents);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
      binaryDer[i] = binaryDerString.charCodeAt(i);
    }
    
    return await crypto.subtle.importKey(
      'pkcs8',
      binaryDer.buffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      true,
      ['decrypt']
    );
  }

  /**
   * ArrayBuffer 转 Base64
   */
  arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Base64 转 ArrayBuffer
   */
  base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
