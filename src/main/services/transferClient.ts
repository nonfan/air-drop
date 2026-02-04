/**
 * 传输客户端 - 用于发送文件到其他设备
 */
import * as http from 'http';
import * as fs from 'fs';
import FormData from 'form-data';

export interface TransferProgress {
  transferId: string;
  fileName: string;
  chunkIndex: number;
  totalChunks: number;
  sentBytes: number;
  totalBytes: number;
  progress: number;
  speed: number;
}

export class TransferClient {
  private chunkSize: number = 1024 * 1024; // 1MB

  /**
   * 发送传输请求
   */
  async sendTransferRequest(
    targetIP: string,
    targetPort: number,
    transferId: string,
    fileName: string,
    fileSize: number,
    fromDeviceId: string,
    fromDeviceName: string
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        transferId,
        fileName,
        fileSize,
        fromDeviceId,
        fromDeviceName
      });

      const options = {
        hostname: targetIP,
        port: targetPort,
        path: '/api/transfer/request',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        
        res.on('data', chunk => {
          body += chunk.toString();
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            resolve(result.success === true);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  /**
   * 发送文件（分片上传）
   */
  async sendFile(
    targetIP: string,
    targetPort: number,
    transferId: string,
    filePath: string,
    onProgress?: (progress: TransferProgress) => void
  ): Promise<void> {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const fileName = require('path').basename(filePath);
    const totalChunks = Math.ceil(fileSize / this.chunkSize);

    console.log(`[TransferClient] Sending file: ${fileName} (${fileSize} bytes, ${totalChunks} chunks)`);

    const startTime = Date.now();
    let sentBytes = 0;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * this.chunkSize;
      const end = Math.min(start + this.chunkSize, fileSize);
      const chunkBuffer = Buffer.alloc(end - start);

      // 读取分片
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, chunkBuffer, 0, chunkBuffer.length, start);
      fs.closeSync(fd);

      // 发送分片
      await this.sendChunk(
        targetIP,
        targetPort,
        transferId,
        fileName,
        chunkIndex,
        totalChunks,
        chunkBuffer
      );

      sentBytes += chunkBuffer.length;

      // 计算进度和速度
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = elapsed > 0 ? sentBytes / elapsed : 0;
      const progress = (sentBytes / fileSize) * 100;

      if (onProgress) {
        onProgress({
          transferId,
          fileName,
          chunkIndex,
          totalChunks,
          sentBytes,
          totalBytes: fileSize,
          progress,
          speed
        });
      }

      console.log(`[TransferClient] Sent chunk ${chunkIndex + 1}/${totalChunks} (${progress.toFixed(1)}%)`);
    }

    console.log(`[TransferClient] File sent successfully: ${fileName}`);
  }

  /**
   * 发送单个分片
   */
  private async sendChunk(
    targetIP: string,
    targetPort: number,
    transferId: string,
    fileName: string,
    chunkIndex: number,
    totalChunks: number,
    chunkBuffer: Buffer
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('transferId', transferId);
      form.append('chunkIndex', chunkIndex.toString());
      form.append('totalChunks', totalChunks.toString());
      form.append('fileName', fileName);
      form.append('file', chunkBuffer, {
        filename: `chunk_${chunkIndex}`,
        contentType: 'application/octet-stream'
      });

      const options = {
        hostname: targetIP,
        port: targetPort,
        path: '/api/transfer/chunk',
        method: 'POST',
        headers: form.getHeaders()
      };

      const req = http.request(options, (res) => {
        let body = '';
        
        res.on('data', chunk => {
          body += chunk.toString();
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      form.pipe(req);
    });
  }

  /**
   * 测试连接
   */
  async testConnection(targetIP: string, targetPort: number): Promise<boolean> {
    return new Promise((resolve) => {
      const options = {
        hostname: targetIP,
        port: targetPort,
        path: '/api/ping',
        method: 'GET',
        timeout: 3000
      };

      const req = http.request(options, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }
}
