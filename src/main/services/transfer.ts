import { WebSocketServer, WebSocket } from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

interface FileInfo {
  name: string;
  size: number;
  receivedSize?: number;
  writeStream?: fs.WriteStream;
}

interface PendingTransfer {
  transferId: string;
  senderName: string;
  files: FileInfo[];
  currentFileIndex: number;
  ws: WebSocket;
  accepted: boolean;
  totalSize: number;
  receivedSize: number;
}

export class FileTransferServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private downloadPath: string;
  private pendingTransfers: Map<string, PendingTransfer> = new Map();
  private wsToTransfer: Map<WebSocket, string> = new Map();
  private onIncomingFile: (info: { transferId: string; senderName: string; files: { name: string; size: number }[]; totalSize: number }) => void;
  private deviceName: string;

  constructor(downloadPath: string, deviceName: string, onIncomingFile: (info: { transferId: string; senderName: string; files: { name: string; size: number }[]; totalSize: number }) => void) {
    super();
    this.downloadPath = downloadPath;
    this.deviceName = deviceName;
    this.onIncomingFile = onIncomingFile;
  }

  setDownloadPath(p: string) {
    this.downloadPath = p;
  }

  async start(): Promise<number> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: 0 }, () => {
        const address = this.wss?.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        resolve(port);
      });

      this.wss.on('connection', (ws) => this.handleConnection(ws));
    });
  }

  private handleConnection(ws: WebSocket): void {
    ws.on('message', (data: Buffer, isBinary: boolean) => {
      if (!isBinary) {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
          return;
        } catch {
          // Not JSON
        }
      }
      // Binary data - file chunk
      this.handleFileData(ws, data);
    });

    ws.on('close', () => {
      const transferId = this.wsToTransfer.get(ws);
      if (transferId) {
        const transfer = this.pendingTransfers.get(transferId);
        if (transfer) {
          // Close any open write streams
          for (const file of transfer.files) {
            file.writeStream?.close();
          }
          this.pendingTransfers.delete(transferId);
        }
        this.wsToTransfer.delete(ws);
      }
    });
  }


  private handleMessage(ws: WebSocket, message: any): void {
    if (message.type === 'transfer-request') {
      const transferId = uuidv4();
      const totalSize = message.files.reduce((sum: number, f: any) => sum + f.size, 0);
      
      const transfer: PendingTransfer = {
        transferId,
        senderName: message.senderName,
        files: message.files.map((f: any) => ({ name: f.name, size: f.size, receivedSize: 0 })),
        currentFileIndex: 0,
        ws,
        accepted: false,
        totalSize,
        receivedSize: 0
      };
      
      this.pendingTransfers.set(transferId, transfer);
      this.wsToTransfer.set(ws, transferId);
      
      this.onIncomingFile({
        transferId,
        senderName: message.senderName,
        files: message.files.map((f: any) => ({ name: f.name, size: f.size })),
        totalSize
      });
    } else if (message.type === 'file-start') {
      // Sender is starting to send a file
      const transferId = this.wsToTransfer.get(ws);
      if (transferId) {
        const transfer = this.pendingTransfers.get(transferId);
        if (transfer && transfer.accepted) {
          const file = transfer.files[message.index];
          if (file) {
            const filePath = this.getUniqueFilePath(file.name);
            file.writeStream = fs.createWriteStream(filePath);
            file.receivedSize = 0;
          }
        }
      }
    } else if (message.type === 'file-end') {
      const transferId = this.wsToTransfer.get(ws);
      if (transferId) {
        const transfer = this.pendingTransfers.get(transferId);
        if (transfer) {
          const file = transfer.files[message.index];
          if (file?.writeStream) {
            file.writeStream.close();
            file.writeStream = undefined;
          }
          transfer.currentFileIndex++;
          
          // Check if all files received
          if (transfer.currentFileIndex >= transfer.files.length) {
            ws.send(JSON.stringify({ type: 'transfer-complete' }));
            this.emit('transfer-complete', { transferId, success: true });
            this.pendingTransfers.delete(transferId);
            this.wsToTransfer.delete(ws);
          }
        }
      }
    }
  }

  private getUniqueFilePath(fileName: string): string {
    let filePath = path.join(this.downloadPath, fileName);
    let counter = 1;
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    
    while (fs.existsSync(filePath)) {
      filePath = path.join(this.downloadPath, `${base} (${counter})${ext}`);
      counter++;
    }
    return filePath;
  }

  private handleFileData(ws: WebSocket, data: Buffer): void {
    const transferId = this.wsToTransfer.get(ws);
    if (!transferId) return;
    
    const transfer = this.pendingTransfers.get(transferId);
    if (!transfer || !transfer.accepted) return;
    
    const file = transfer.files[transfer.currentFileIndex];
    if (file?.writeStream) {
      file.writeStream.write(data);
      file.receivedSize = (file.receivedSize || 0) + data.length;
      transfer.receivedSize += data.length;
      
      // Emit progress
      const percent = Math.round((transfer.receivedSize / transfer.totalSize) * 100);
      this.emit('transfer-progress', { 
        transferId, 
        percent,
        receivedSize: transfer.receivedSize,
        totalSize: transfer.totalSize,
        currentFile: file.name
      });
    }
  }

  acceptTransfer(transferId: string): void {
    const transfer = this.pendingTransfers.get(transferId);
    if (transfer) {
      transfer.accepted = true;
      transfer.ws.send(JSON.stringify({ type: 'transfer-accepted' }));
    }
  }

  rejectTransfer(transferId: string): void {
    const transfer = this.pendingTransfers.get(transferId);
    if (transfer) {
      transfer.ws.send(JSON.stringify({ type: 'transfer-rejected' }));
      transfer.ws.close();
      this.pendingTransfers.delete(transferId);
      this.wsToTransfer.delete(transfer.ws);
    }
  }

  async sendFiles(ip: string, port: number, filePaths: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://${ip}:${port}`);
      const CHUNK_SIZE = 64 * 1024; // 64KB chunks
      let cancelled = false;
      let currentReadStream: fs.ReadStream | null = null;
      
      const files = filePaths.map(fp => ({
        path: fp,
        name: path.basename(fp),
        size: fs.statSync(fp).size
      }));
      
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      let sentSize = 0;

      const cleanup = () => {
        cancelled = true;
        if (currentReadStream) {
          currentReadStream.destroy();
          currentReadStream = null;
        }
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      };

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'transfer-request',
          senderName: this.deviceName,
          files: files.map(f => ({ name: f.name, size: f.size }))
        }));
      });

      ws.on('message', async (data: Buffer) => {
        if (cancelled) return;
        
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'transfer-accepted') {
          try {
            // Send files one by one with chunking
            for (let i = 0; i < files.length; i++) {
              if (cancelled) break;
              
              const file = files[i];
              
              // Notify file start
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'file-start', index: i, name: file.name }));
              }
              
              // Stream file in chunks
              await this.streamFile(ws, file.path, CHUNK_SIZE, (chunkSize, readStream) => {
                currentReadStream = readStream;
                if (cancelled) {
                  readStream.destroy();
                  return;
                }
                sentSize += chunkSize;
                const percent = Math.round((sentSize / totalSize) * 100);
                this.emit('send-progress', { percent, sentSize, totalSize, currentFile: file.name });
              });
              
              currentReadStream = null;
              
              // Notify file end
              if (ws.readyState === WebSocket.OPEN && !cancelled) {
                ws.send(JSON.stringify({ type: 'file-end', index: i }));
              }
            }
          } catch (err) {
            if (!cancelled) {
              this.emit('send-complete', { success: false, reason: 'error' });
              cleanup();
              reject(err);
            }
          }
        } else if (msg.type === 'transfer-complete') {
          this.emit('send-complete', { success: true });
          cleanup();
          resolve();
        } else if (msg.type === 'transfer-rejected') {
          this.emit('send-complete', { success: false, reason: 'rejected' });
          cleanup();
          reject(new Error('Transfer rejected'));
        }
      });

      ws.on('error', (err) => {
        if (!cancelled) {
          this.emit('send-complete', { success: false, reason: err.message });
          cleanup();
          reject(err);
        }
      });

      ws.on('close', () => {
        if (!cancelled) {
          cancelled = true;
        }
      });
    });
  }

  private streamFile(ws: WebSocket, filePath: string, chunkSize: number, onChunk: (size: number, stream: fs.ReadStream) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(filePath, { highWaterMark: chunkSize });
      
      readStream.on('data', (chunk: Buffer | string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(chunk);
          onChunk(typeof chunk === 'string' ? chunk.length : chunk.length, readStream);
        } else {
          readStream.destroy();
        }
      });
      
      readStream.on('end', resolve);
      readStream.on('error', reject);
      readStream.on('close', resolve);
    });
  }

  stop(): void {
    // Close all pending transfers
    for (const transfer of this.pendingTransfers.values()) {
      for (const file of transfer.files) {
        file.writeStream?.close();
      }
      transfer.ws.close();
    }
    this.pendingTransfers.clear();
    this.wsToTransfer.clear();
    this.wss?.close();
  }
}
