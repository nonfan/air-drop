import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import Peer, { DataConnection } from 'peerjs';

interface FileInfo {
  name: string;
  size: number;
  path?: string;
}

interface TransferMetadata {
  type: 'transfer-request';
  transferId: string;
  senderName: string;
  files: FileInfo[];
  totalSize: number;
}

interface FileChunk {
  type: 'file-chunk';
  transferId: string;
  fileIndex: number;
  chunk: ArrayBuffer;
  offset: number;
}

interface FileComplete {
  type: 'file-complete';
  transferId: string;
  fileIndex: number;
}

interface TransferResponse {
  type: 'transfer-accepted' | 'transfer-rejected';
  transferId: string;
}

interface PendingTransfer {
  transferId: string;
  senderName: string;
  files: FileInfo[];
  totalSize: number;
  receivedSize: number;
  currentFileIndex: number;
  writeStreams: Map<number, fs.WriteStream>;
  filePaths: Map<number, string>;
  conn: DataConnection;
}

export class PeerTransferService extends EventEmitter {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private pendingTransfers: Map<string, PendingTransfer> = new Map();
  private downloadPath: string;
  private deviceName: string;
  private peerId: string = '';
  private onIncomingFile: (info: { transferId: string; senderName: string; files: { name: string; size: number }[]; totalSize: number }) => void;

  constructor(
    downloadPath: string,
    deviceName: string,
    onIncomingFile: (info: { transferId: string; senderName: string; files: { name: string; size: number }[]; totalSize: number }) => void
  ) {
    super();
    this.downloadPath = downloadPath;
    this.deviceName = deviceName;
    this.onIncomingFile = onIncomingFile;
  }

  setDownloadPath(p: string) {
    this.downloadPath = p;
  }

  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      // 使用设备名称和时间戳作为peer ID
      this.peerId = `airdrop-${this.deviceName.replace(/\s+/g, '-')}-${Date.now()}`;
      
      // 创建Peer实例，使用公共的PeerJS云服务器（仅用于信令）
      // 实际数据传输是P2P的，不经过服务器
      this.peer = new Peer(this.peerId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }, // 用于NAT穿透
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        console.log('Peer opened with ID:', id);
        this.peerId = id;
        // 返回一个虚拟端口号，实际使用peer ID
        resolve(9000);
      });

      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        // 即使出错也resolve，让应用继续运行
        if (err.type === 'unavailable-id') {
          // ID被占用，重新生成
          this.peerId = `airdrop-${this.deviceName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
          this.start().then(resolve).catch(reject);
        } else {
          resolve(9000); // 继续运行，使用WebSocket作为后备
        }
      });
    });
  }

  getPeerId(): string {
    return this.peerId;
  }

  private handleConnection(conn: DataConnection) {
    console.log('New connection from:', conn.peer);
    this.connections.set(conn.peer, conn);

    conn.on('data', (data: any) => {
      this.handleData(conn, data);
    });

    conn.on('close', () => {
      console.log('Connection closed:', conn.peer);
      this.connections.delete(conn.peer);
      
      // 清理未完成的传输
      for (const [transferId, transfer] of this.pendingTransfers.entries()) {
        if (transfer.conn === conn) {
          this.cleanupTransfer(transferId);
        }
      }
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
    });
  }

  private handleData(conn: DataConnection, data: any) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'transfer-request':
        this.handleTransferRequest(conn, data as TransferMetadata);
        break;
      case 'file-chunk':
        this.handleFileChunk(data as FileChunk);
        break;
      case 'file-complete':
        this.handleFileComplete(data as FileComplete);
        break;
      case 'transfer-accepted':
      case 'transfer-rejected':
        this.handleTransferResponse(data as TransferResponse);
        break;
    }
  }

  private handleTransferRequest(conn: DataConnection, metadata: TransferMetadata) {
    const transfer: PendingTransfer = {
      transferId: metadata.transferId,
      senderName: metadata.senderName,
      files: metadata.files,
      totalSize: metadata.totalSize,
      receivedSize: 0,
      currentFileIndex: 0,
      writeStreams: new Map(),
      filePaths: new Map(),
      conn
    };

    this.pendingTransfers.set(metadata.transferId, transfer);

    this.onIncomingFile({
      transferId: metadata.transferId,
      senderName: metadata.senderName,
      files: metadata.files,
      totalSize: metadata.totalSize
    });
  }

  private handleFileChunk(data: FileChunk) {
    const transfer = this.pendingTransfers.get(data.transferId);
    if (!transfer) return;

    let writeStream = transfer.writeStreams.get(data.fileIndex);
    
    if (!writeStream) {
      // 创建新的写入流，使用更大的缓冲区
      const file = transfer.files[data.fileIndex];
      const filePath = this.getUniqueFilePath(file.name);
      transfer.filePaths.set(data.fileIndex, filePath);
      writeStream = fs.createWriteStream(filePath, { 
        highWaterMark: 256 * 1024 // 256KB 写入缓冲区
      });
      transfer.writeStreams.set(data.fileIndex, writeStream);
    }

    // 写入数据
    const buffer = Buffer.from(data.chunk);
    
    // 检查写入流是否可以继续写入
    const canWrite = writeStream.write(buffer);
    
    if (!canWrite) {
      // 如果缓冲区满了，等待 drain 事件
      writeStream.once('drain', () => {
        // 缓冲区已清空，可以继续接收
      });
    }
    
    transfer.receivedSize += buffer.length;
    
    // 发送进度（限流：每 100KB 或每秒更新一次）
    const now = Date.now();
    const lastUpdate = (transfer as any).lastProgressUpdate || 0;
    const sizeSinceUpdate = transfer.receivedSize - ((transfer as any).lastProgressSize || 0);
    
    if (now - lastUpdate > 1000 || sizeSinceUpdate > 100 * 1024) {
      const percent = Math.round((transfer.receivedSize / transfer.totalSize) * 100);
      this.emit('transfer-progress', {
        transferId: data.transferId,
        percent,
        receivedSize: transfer.receivedSize,
        totalSize: transfer.totalSize,
        currentFile: transfer.files[data.fileIndex].name
      });
      (transfer as any).lastProgressUpdate = now;
      (transfer as any).lastProgressSize = transfer.receivedSize;
    }
  }

  private handleFileComplete(data: FileComplete) {
    const transfer = this.pendingTransfers.get(data.transferId);
    if (!transfer) return;

    const writeStream = transfer.writeStreams.get(data.fileIndex);
    if (writeStream) {
      writeStream.end();
      transfer.writeStreams.delete(data.fileIndex);
    }

    // 检查是否所有文件都已接收
    if (data.fileIndex === transfer.files.length - 1) {
      // 传输完成
      const files = Array.from(transfer.filePaths.entries()).map(([index, filePath]) => ({
        name: transfer.files[index].name,
        path: filePath,
        size: transfer.files[index].size
      }));

      this.emit('transfer-complete', {
        transferId: data.transferId,
        success: true,
        files,
        senderName: transfer.senderName
      });

      this.cleanupTransfer(data.transferId);
    }
  }

  private handleTransferResponse(data: TransferResponse) {
    // 这个会在发送端处理
    this.emit('transfer-response', data);
  }

  acceptTransfer(transferId: string): void {
    const transfer = this.pendingTransfers.get(transferId);
    if (transfer && transfer.conn) {
      transfer.conn.send({
        type: 'transfer-accepted',
        transferId
      });
    }
  }

  rejectTransfer(transferId: string): void {
    const transfer = this.pendingTransfers.get(transferId);
    if (transfer && transfer.conn) {
      transfer.conn.send({
        type: 'transfer-rejected',
        transferId
      });
      this.cleanupTransfer(transferId);
    }
  }

  async sendFiles(peerId: string, filePaths: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.peer) {
        reject(new Error('Peer not initialized'));
        return;
      }

      const conn = this.peer.connect(peerId, {
        reliable: true,
        serialization: 'binary'
      });

      const transferId = uuidv4();
      
      const files = filePaths.map(fp => ({
        path: fp,
        name: path.basename(fp),
        size: fs.statSync(fp).size
      }));

      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      
      // 根据文件大小动态调整分块大小
      // 小文件: 16KB, 中等文件: 64KB, 大文件: 256KB
      let CHUNK_SIZE = 16 * 1024;
      if (totalSize > 100 * 1024 * 1024) { // > 100MB
        CHUNK_SIZE = 256 * 1024; // 256KB
      } else if (totalSize > 10 * 1024 * 1024) { // > 10MB
        CHUNK_SIZE = 64 * 1024; // 64KB
      }
      
      console.log(`Transfer size: ${(totalSize / 1024 / 1024).toFixed(2)}MB, chunk size: ${CHUNK_SIZE / 1024}KB`);
      
      let sentSize = 0;
      let accepted = false;
      
      // 设置超时（大文件给更长时间）
      const timeout = Math.max(60000, totalSize / 1024 / 1024 * 1000); // 至少1分钟，或每MB 1秒
      const timeoutTimer = setTimeout(() => {
        if (!accepted) {
          this.emit('send-complete', { success: false, reason: 'timeout' });
          conn.close();
          reject(new Error('Transfer timeout'));
        }
      }, timeout);

      conn.on('open', () => {
        console.log('Connected to peer:', peerId);
        
        // 发送传输请求
        const metadata: TransferMetadata = {
          type: 'transfer-request',
          transferId,
          senderName: this.deviceName,
          files: files.map(f => ({ name: f.name, size: f.size })),
          totalSize
        };
        
        conn.send(metadata);
      });

      conn.on('data', async (data: any) => {
        if (data.type === 'transfer-accepted' && data.transferId === transferId) {
          accepted = true;
          clearTimeout(timeoutTimer);
          
          try {
            // 开始发送文件
            for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
              const file = files[fileIndex];
              await this.sendFile(conn, transferId, fileIndex, file.path, CHUNK_SIZE, (chunkSize) => {
                sentSize += chunkSize;
                const percent = Math.round((sentSize / totalSize) * 100);
                this.emit('send-progress', {
                  percent,
                  sentSize,
                  totalSize,
                  currentFile: file.name
                });
              });
            }
            
            this.emit('send-complete', { success: true });
            conn.close();
            resolve();
          } catch (err) {
            this.emit('send-complete', { success: false, reason: 'error' });
            conn.close();
            reject(err);
          }
        } else if (data.type === 'transfer-rejected' && data.transferId === transferId) {
          clearTimeout(timeoutTimer);
          this.emit('send-complete', { success: false, reason: 'rejected' });
          conn.close();
          reject(new Error('Transfer rejected'));
        }
      });

      conn.on('error', (err) => {
        clearTimeout(timeoutTimer);
        if (!accepted) {
          this.emit('send-complete', { success: false, reason: err.message });
          reject(err);
        }
      });

      conn.on('close', () => {
        clearTimeout(timeoutTimer);
        if (!accepted) {
          this.emit('send-complete', { success: false, reason: 'connection closed' });
          reject(new Error('Connection closed before acceptance'));
        }
      });
    });
  }

  private sendFile(
    conn: DataConnection,
    transferId: string,
    fileIndex: number,
    filePath: string,
    chunkSize: number,
    onChunk: (size: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(filePath, { highWaterMark: chunkSize });
      let offset = 0;
      let isPaused = false;

      const sendChunk = (chunk: Buffer | string) => {
        if (typeof chunk === 'string') return;
        
        const buffer = chunk as Buffer;
        
        const chunkData: FileChunk = {
          type: 'file-chunk',
          transferId,
          fileIndex,
          chunk: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
          offset
        };

        // 检查连接的缓冲区
        const bufferedAmount = (conn as any)._channel?.bufferedAmount || 0;
        const maxBuffer = 16 * 1024 * 1024; // 16MB 缓冲区限制

        if (bufferedAmount > maxBuffer) {
          // 缓冲区满了，暂停读取
          if (!isPaused) {
            isPaused = true;
            readStream.pause();
            
            // 等待缓冲区清空
            const checkBuffer = setInterval(() => {
              const currentBuffer = (conn as any)._channel?.bufferedAmount || 0;
              if (currentBuffer < maxBuffer / 2) {
                clearInterval(checkBuffer);
                isPaused = false;
                readStream.resume();
              }
            }, 100);
          }
        }

        conn.send(chunkData);
        offset += buffer.length;
        onChunk(buffer.length);
      };

      readStream.on('data', sendChunk);

      readStream.on('end', () => {
        // 发送文件完成信号
        const completeData: FileComplete = {
          type: 'file-complete',
          transferId,
          fileIndex
        };
        conn.send(completeData);
        resolve();
      });

      readStream.on('error', (err) => {
        reject(err);
      });
    });
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

  private cleanupTransfer(transferId: string) {
    const transfer = this.pendingTransfers.get(transferId);
    if (transfer) {
      // 关闭所有写入流
      for (const stream of transfer.writeStreams.values()) {
        stream.end();
      }
      this.pendingTransfers.delete(transferId);
    }
  }

  stop(): void {
    // 清理所有传输
    for (const transferId of this.pendingTransfers.keys()) {
      this.cleanupTransfer(transferId);
    }

    // 关闭所有连接
    for (const conn of this.connections.values()) {
      conn.close();
    }
    this.connections.clear();

    // 销毁peer
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
