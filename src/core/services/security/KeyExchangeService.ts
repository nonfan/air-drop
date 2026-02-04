/**
 * 密钥交换服务
 * 处理会话密钥的加密传输
 */

import { CryptoService, SessionKey } from './CryptoService';

export class KeyExchangeService {
  private cryptoService: CryptoService;

  constructor() {
    this.cryptoService = new CryptoService();
  }

  /**
   * 发送方：加密会话密钥
   */
  async encryptSessionKey(
    sessionKey: SessionKey,
    recipientPublicKey: string
  ): Promise<string> {
    const publicKey = await this.cryptoService.importPublicKey(recipientPublicKey);
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP'
      },
      publicKey,
      sessionKey.key
    );
    
    return this.cryptoService.arrayBufferToBase64(encrypted);
  }

  /**
   * 接收方：解密会话密钥
   */
  async decryptSessionKey(
    encryptedKey: string,
    privateKey: string
  ): Promise<Uint8Array> {
    const key = await this.cryptoService.importPrivateKey(privateKey);
    
    const encrypted = this.cryptoService.base64ToArrayBuffer(encryptedKey);
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP'
      },
      key,
      encrypted
    );
    
    return new Uint8Array(decrypted);
  }

  /**
   * 加密会话密钥的 IV
   */
  async encryptSessionIV(
    iv: Uint8Array,
    recipientPublicKey: string
  ): Promise<string> {
    const publicKey = await this.cryptoService.importPublicKey(recipientPublicKey);
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP'
      },
      publicKey,
      iv
    );
    
    return this.cryptoService.arrayBufferToBase64(encrypted);
  }

  /**
   * 解密会话密钥的 IV
   */
  async decryptSessionIV(
    encryptedIV: string,
    privateKey: string
  ): Promise<Uint8Array> {
    const key = await this.cryptoService.importPrivateKey(privateKey);
    
    const encrypted = this.cryptoService.base64ToArrayBuffer(encryptedIV);
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP'
      },
      key,
      encrypted
    );
    
    return new Uint8Array(decrypted);
  }
}
