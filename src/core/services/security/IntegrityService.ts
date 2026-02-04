/**
 * 完整性验证服务
 * 提供哈希计算和数字签名功能
 */

import { CryptoService } from './CryptoService';

export class IntegrityService {
  private cryptoService: CryptoService;

  constructor() {
    this.cryptoService = new CryptoService();
  }

  /**
   * 计算文件哈希
   */
  async calculateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return this.arrayBufferToHex(hashBuffer);
  }

  /**
   * 验证文件完整性
   */
  async verifyFileIntegrity(file: File, expectedHash: string): Promise<boolean> {
    const actualHash = await this.calculateFileHash(file);
    return actualHash === expectedHash;
  }

  /**
   * 计算分片哈希
   */
  async calculateChunkHash(chunk: Blob): Promise<string> {
    const buffer = await chunk.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return this.arrayBufferToHex(hashBuffer);
  }

  /**
   * 签名数据
   */
  async signData(data: ArrayBuffer, privateKey: string): Promise<string> {
    const key = await this.importPrivateKeyForSigning(privateKey);
    
    const signature = await crypto.subtle.sign(
      {
        name: 'RSA-PSS',
        saltLength: 32
      },
      key,
      data
    );
    
    return this.cryptoService.arrayBufferToBase64(signature);
  }

  /**
   * 验证签名
   */
  async verifySignature(
    data: ArrayBuffer,
    signature: string,
    publicKey: string
  ): Promise<boolean> {
    const key = await this.importPublicKeyForVerifying(publicKey);
    const sig = this.cryptoService.base64ToArrayBuffer(signature);
    
    return await crypto.subtle.verify(
      {
        name: 'RSA-PSS',
        saltLength: 32
      },
      key,
      sig,
      data
    );
  }

  /**
   * ArrayBuffer 转十六进制字符串
   */
  private arrayBufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * 导入私钥用于签名
   */
  private async importPrivateKeyForSigning(pem: string): Promise<CryptoKey> {
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
      binaryDer,
      {
        name: 'RSA-PSS',
        hash: 'SHA-256'
      },
      true,
      ['sign']
    );
  }

  /**
   * 导入公钥用于验证
   */
  private async importPublicKeyForVerifying(pem: string): Promise<CryptoKey> {
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
      binaryDer,
      {
        name: 'RSA-PSS',
        hash: 'SHA-256'
      },
      true,
      ['verify']
    );
  }
}
