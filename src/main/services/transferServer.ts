/**
 * 传输服务器 - 处理桌面端到桌面端的文件传输
 */
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import Busboy from 'busboy';
import { v4 as uuidv4 } from 'uuid';

interface TransferRequest {
  transferId: string;
  fileName: string;
  fileSize: number;
  fromDeviceId: string;
  fromDeviceName: string;
}

interface ChunkUpload {
  transferId: string;
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
  data: Buffer;
}

export class TransferServer extends EventEmitter {
  private httpServer: http.Server | null = null;
  private port: number = 3001;
  private pendingTransfers: Map<string, TransferRequest> = new Map();
  private uploadBuffers: Map<string, Map<number, Buffer>> = new Map();
  private downloadPath: string;

  constructor(downloadPath: string) {
    super();
    this.downloadPath = downloadPath;
  }

  async start(port: number = 3001): Promise<number> {
    this.port = port;
    
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => this.handleRequest(req, res));
      
      this.httpServer.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          // 端口被占用或权限不足，尝试下一个端口
          console.log(`[TransferServer] Port ${this.port} unavailable, trying ${this.port + 1}...`);
          this.port++;
          this.httpServer?.listen(this.port, '127.0.0.1');
        } else {
          reject(err);
        }
      });

      this.httpServer.listen(this.port, '127.0.0.1', () => {
        console.log(`[TransferServer] Started on port ${this.port}`);
        resolve(this.port);
      });
    });
  }

  stop() {
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
      console.log('[TransferServer] Stopped');
    }
  }

  getPort(): number {
    return this.port;
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = req.url || '/';
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    console.log(`[TransferServer] ${req.method} ${url}`);

    if (url === '/api/transfer/request' && req.method === 'POST') {
      this.handleTransferRequest(req, res);
    } else if (url === '/api/transfer/chunk' && req.method === 'POST') {
      this.handleChunkUpload(req, res);
    } else if (url.startsWith('/api/transfer/download/') && req.method === 'GET') {
      const transferId = url.replace('/api/transfer/download/', '');
      this.handleDownload(transferId, res);
    } else if (url === '/api/ping' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }

  /**
   * 处理传输请求
   */
  private handleTransferRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const transferRequest: TransferRequest = {
          transferId: data.transferId || uuidv4(),
          fileName: data.fileName,
          fileSize: data.fileSize,
          fromDeviceId: data.fromDeviceId,
          fromDeviceName: data.fromDeviceName
        };

        this.pendingTransfers.set(transferRequest.transferId, transferRequest);
        
        // 触发事件，通知主进程有新的传输请求
        this.emit('transfer-request', transferRequest);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          transferId: transferRequest.transferId
        }));
      } catch (error: any) {
        console.error('[TransferServer] Error handling transfer request:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
  }

  /**
   * 处理分片上传
   */
  private handleChunkUpload(req: http.IncomingMessage, res: http.ServerResponse) {
    const busboy = Busboy({ headers: req.headers as any });
    let chunkData: ChunkUpload | null = null;
    let fileBuffer: Buffer | null = null;

    busboy.on('field', (name, value) => {
      if (!chunkData) {
        chunkData = {
          transferId: '',
          chunkIndex: 0,
          totalChunks: 0,
          fileName: '',
          data: Buffer.alloc(0)
        };
      }

      if (name === 'transferId') chunkData.transferId = value;
      else if (name === 'chunkIndex') chunkData.chunkIndex = parseInt(value);
      else if (name === 'totalChunks') chunkData.totalChunks = parseInt(value);
      else if (name === 'fileName') chunkData.fileName = value;
    });

    busboy.on('file', (name, file, info) => {
      const chunks: Buffer[] = [];
      
      file.on('data', (data) => {
        chunks.push(data);
      });

      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on('finish', () => {
      if (!chunkData || !fileBuffer) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid chunk data' }));
        return;
      }

      chunkData.data = fileBuffer;

      // 存储分片
      if (!this.uploadBuffers.has(chunkData.transferId)) {
        this.uploadBuffers.set(chunkData.transferId, new Map());
      }
      
      const chunks = this.uploadBuffers.get(chunkData.transferId)!;
      chunks.set(chunkData.chunkIndex, chunkData.data);

      console.log(`[TransferServer] Received chunk ${chunkData.chunkIndex + 1}/${chunkData.totalChunks} for ${chunkData.fileName}`);

      // 触发进度事件
      this.emit('chunk-received', {
        transferId: chunkData.transferId,
        chunkIndex: chunkData.chunkIndex,
        totalChunks: chunkData.totalChunks,
        progress: ((chunkData.chunkIndex + 1) / chunkData.totalChunks) * 100
      });

      // 检查是否所有分片都已接收
      if (chunks.size === chunkData.totalChunks) {
        this.assembleFile(chunkData.transferId, chunkData.fileName, chunkData.totalChunks);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });

    req.pipe(busboy);
  }

  /**
   * 组装文件
   */
  private assembleFile(transferId: string, fileName: string, totalChunks: number) {
    const chunks = this.uploadBuffers.get(transferId);
    if (!chunks) {
      console.error('[TransferServer] No chunks found for transfer:', transferId);
      return;
    }

    try {
      // 按顺序组装分片
      const buffers: Buffer[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks.get(i);
        if (!chunk) {
          throw new Error(`Missing chunk ${i}`);
        }
        buffers.push(chunk);
      }

      const fileBuffer = Buffer.concat(buffers);
      const filePath = path.join(this.downloadPath, fileName);

      // 写入文件
      fs.writeFileSync(filePath, fileBuffer);

      console.log(`[TransferServer] File assembled: ${filePath}`);

      // 清理
      this.uploadBuffers.delete(transferId);
      this.pendingTransfers.delete(transferId);

      // 触发完成事件
      this.emit('transfer-complete', {
        transferId,
        fileName,
        filePath,
        size: fileBuffer.length
      });
    } catch (error: any) {
      console.error('[TransferServer] Error assembling file:', error);
      this.emit('transfer-error', {
        transferId,
        error: error.message
      });
    }
  }

  /**
   * 处理文件下载
   */
  private handleDownload(transferId: string, res: http.ServerResponse) {
    const transfer = this.pendingTransfers.get(transferId);
    if (!transfer) {
      res.writeHead(404);
      res.end('Transfer not found');
      return;
    }

    // 这里应该从发送方获取文件
    // 目前只是占位符
    res.writeHead(501);
    res.end('Download not implemented yet');
  }
}
