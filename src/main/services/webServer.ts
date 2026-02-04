import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { EventEmitter } from 'events';
import { networkInterfaces } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { app } from 'electron';
import Busboy from 'busboy';

interface MobileClient {
  id: string;
  name: string;
  model: string;
  socket: Socket;
  ip: string;
  connectedAt: number;
}

interface SharedFileInfo {
  filePath: string;
  targetClientId: string | null;
}

interface SharedText {
  text: string;
  targetClientId: string | null;
  timestamp: number;
}

interface LANDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
  type: 'pc';
}

export class WebFileServer extends EventEmitter {
  private httpServer: http.Server | null = null;
  private io: SocketIOServer | null = null;
  private downloadPath: string;
  private deviceName: string;
  private port: number = 8888;
  private sharedFiles: Map<string, SharedFileInfo> = new Map();
  private clients: Map<string, MobileClient> = new Map();
  private sharedTexts: Map<string, SharedText> = new Map();
  private lanDevices: Map<string, LANDevice> = new Map();

  constructor(downloadPath: string, deviceName: string) {
    super();
    this.downloadPath = downloadPath;
    this.deviceName = deviceName;
  }

  updateLANDevice(device: LANDevice) {
    this.lanDevices.set(device.id, device);
    this.broadcastDeviceList();
  }

  removeLANDevice(deviceId: string) {
    this.lanDevices.delete(deviceId);
    this.broadcastDeviceList();
  }

  private broadcastDeviceList() {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.socket.connected) {
        const devices = this.getDeviceListForMobile(clientId);
        client.socket.emit('devices-updated', { devices });
      }
    }
  }

  private getDeviceListForMobile(excludeClientId?: string) {
    const devices: { id: string; name: string; model: string; ip: string; type: 'pc' | 'mobile' }[] = [];
    // 每次都创建新对象，确保 React 能检测到变化
    devices.push({ 
      id: 'host', 
      name: this.deviceName, 
      model: 'Windows', 
      ip: this.getLocalIP(), 
      type: 'pc',
      // 添加时间戳确保对象唯一性
      _timestamp: Date.now()
    } as any);
    for (const [id, client] of this.clients.entries()) {
      if (id !== excludeClientId) {
        devices.push({ 
          id, 
          name: client.name, 
          model: client.model, 
          ip: client.ip, 
          type: 'mobile',
          // 添加时间戳确保对象唯一性
          _timestamp: Date.now()
        } as any);
      }
    }
    console.log(`[WebServer] getDeviceListForMobile (exclude: ${excludeClientId}):`, devices);
    return devices;
  }

  setDownloadPath(p: string) { this.downloadPath = p; }

  async start(preferredPort: number = 8888): Promise<number> {
    this.port = preferredPort;
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => this.handleRequest(req, res)) as any;
      
      if (!this.httpServer) {
        reject(new Error('Failed to create server'));
        return;
      }
      
      this.httpServer.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') { 
          this.port++; 
          this.httpServer?.listen(this.port); 
        } else {
          reject(err);
        }
      });
      this.httpServer.listen(this.port, '0.0.0.0', () => {
        // 初始化 Socket.IO
        this.io = new SocketIOServer(this.httpServer!, {
          cors: {
            origin: '*',
            methods: ['GET', 'POST']
          },
          maxHttpBufferSize: 100 * 1024 * 1024, // 100MB 最大消息大小
          pingTimeout: 60000,
          pingInterval: 25000
        });
        
        this.io.on('connection', (socket) => this.handleSocketConnection(socket));
        console.log(`Web server with Socket.IO started on http://0.0.0.0:${this.port}`);
        resolve(this.port);
      });
    });
  }

  getLocalIP(): string {
    const nets = networkInterfaces();
    const addresses: string[] = [];
    
    for (const name of Object.keys(nets)) {
      const interfaces = nets[name];
      if (!interfaces) continue;
      
      for (const net of interfaces) {
        // Skip internal (loopback) addresses
        if (net.internal) continue;
        
        // Check for IPv4 (family can be string 'IPv4' or number 4)
        const isIPv4 = net.family === 'IPv4' || (net.family as any) === 4;
        if (isIPv4 && net.address) {
          addresses.push(net.address);
        }
      }
    }
    
    // Prefer 192.168.x.x addresses (common home networks)
    const preferred = addresses.find(addr => addr.startsWith('192.168.'));
    if (preferred) return preferred;
    
    // Try 10.x.x.x (another common private network range)
    const private10 = addresses.find(addr => addr.startsWith('10.'));
    if (private10) return private10;
    
    // Try 172.16-31.x.x (another private network range)
    const private172 = addresses.find(addr => {
      const parts = addr.split('.');
      return parts[0] === '172' && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31;
    });
    if (private172) return private172;
    
    // Otherwise use the first available address
    if (addresses.length > 0) return addresses[0];
    
    console.warn('No external IPv4 address found, using localhost');
    return '127.0.0.1';
  }

  getURL(): string { 
    return `http://${this.getLocalIP()}:${this.port}`; 
  }

  getConnectedClients(): { id: string; name: string; ip: string }[] {
    const localIP = this.getLocalIP();
    return Array.from(this.clients.values())
      .filter(c => c.ip !== localIP) // 过滤掉本机 IP
      .map(c => ({ id: c.id, name: c.name, ip: c.ip }));
  }

  private getClientIdFromRequest(req: http.IncomingMessage): string {
    const ip = (req.socket.remoteAddress || '').replace('::ffff:', '');
    for (const [clientId, client] of this.clients.entries()) {
      if (client.ip === ip) return clientId;
    }
    return '';
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = req.url || '/';
    
    // 添加调试日志
    console.log(`[HTTP] ${req.method} ${url}`);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    const isDev = process.env.NODE_ENV === 'development';

    // 开发模式：代理 Vite 相关请求
    if (isDev && (
      url.startsWith('/@') ||           // Vite 内部请求 (/@vite/client, @react-refresh)
      url.startsWith('/src/') ||        // 源码文件
      url.startsWith('/node_modules/') || // 依赖
      url.endsWith('.tsx') ||           // TypeScript 文件
      url.endsWith('.ts') ||
      url.endsWith('.jsx') ||
      url.endsWith('.js') ||
      url.endsWith('.css')
    )) {
      this.proxyToVite(req, res);
      return;
    }

    if (url === '/' || url === '/index.html') {
      this.serveHTML(res);
    } else if (url.startsWith('/styles/')) {
      this.serveTemplateFile(url.replace('/styles/', ''), 'text/css', res);
    } else if (url.startsWith('/scripts/')) {
      this.serveTemplateFile(url.replace('/scripts/', ''), 'application/javascript', res);
    } else if (url === '/icon.png' || url === '/manifest.json' || url.startsWith('/assets/') || /\.(png|jpg|jpeg|svg|ico|json)$/.test(url)) {
      this.serveStaticFile(url, res);
    } else if (url === '/api/info/probe') {
      // UDP 探测接口
      this.handleProbeRequest(res);
    } else if (url.startsWith('/api/info/')) {
      const clientId = url.replace('/api/info/', '');
      this.handleApiInfo(clientId, res);
    } else if (url === '/api/upload' && req.method === 'POST') {
      console.log('[HTTP] Handling file upload');
      this.handleUpload(req, res);
    } else if (url.startsWith('/download/')) {
      const parts = url.replace('/download/', '').split('/');
      if (parts.length === 2) {
        this.handleDownload(parts[0], parts[1], res);
      } else if (parts.length === 1) {
        const clientId = this.getClientIdFromRequest(req);
        this.handleDownload(clientId, parts[0], res);
      } else {
        res.writeHead(404); res.end('Invalid download URL');
      }
    } else {
      console.log(`[HTTP] 404 Not Found: ${url}`);
      res.writeHead(404); res.end('Not Found');
    }
  }

  private serveStaticFile(url: string, res: http.ServerResponse) {
    // 处理 /assets/ 路径或带哈希的资源文件
    let filePath: string;
    
    if (url.startsWith('/assets/')) {
      // 从 src/web/assets 或 dist/web/assets 提供文件
      const assetName = url.replace('/assets/', '');
      const distPath = path.join(__dirname, '../../dist/web/assets', assetName);
      const srcPath = path.join(__dirname, '../../src/web/assets', assetName);
      
      filePath = fs.existsSync(distPath) ? distPath : srcPath;
    } else {
      // 尝试多个可能的位置
      const fileName = path.basename(url);
      const possiblePaths = [
        path.join(__dirname, '../../public', url),
        path.join(__dirname, '../../dist/web', url),
        path.join(__dirname, '../../dist/web/assets', fileName),
        path.join(__dirname, '../../src/web/assets', fileName),
        path.join(__dirname, '../../public', fileName)
      ];
      
      // 找到第一个存在的文件
      filePath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
    }
    
    if (!fs.existsSync(filePath)) {
      // 静默处理 404，因为使用 vite-plugin-singlefile 时资源已内联
      // 只在开发模式下输出警告
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Static file not found: ${url} (资源可能已内联到 HTML)`);
      }
      res.writeHead(404);
      res.end();
      return;
    }

    const ext = path.extname(filePath);
    const contentTypes: { [key: string]: string } = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.json': 'application/json',
      '.ico': 'image/x-icon'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  }

  private serveTemplateFile(fileName: string, contentType: string, res: http.ServerResponse) {
    // __dirname 在编译后是 dist/main/main/services
    // 需要向上到 dist/main/templates
    const templatePath = path.join(__dirname, '../../templates', fileName);
    
    if (!fs.existsSync(templatePath)) {
      console.error('[WebServer] Template not found:', templatePath);
      res.writeHead(404);
      res.end('Template not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType + '; charset=utf-8' });
    fs.createReadStream(templatePath).pipe(res);
  }

  private handleApiInfo(clientId: string, res: http.ServerResponse) {
    const files = this.getFilesForClient(clientId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ deviceName: this.deviceName, files }));
  }

  private handleProbeRequest(res: http.ServerResponse) {
    // 响应探测请求，返回服务器信息
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ 
      id: 'host',
      deviceName: this.deviceName,
      port: this.port,
      timestamp: Date.now()
    }));
  }

  private handleUpload(req: http.IncomingMessage, res: http.ServerResponse) {
    const clientId = this.getClientIdFromRequest(req);
    const client = this.clients.get(clientId);
    const clientName = client ? client.name : '未知设备';

    try {
      const busboy = Busboy({ headers: req.headers });
      
      let fileName = '';
      let targetId = 'host';
      let filePath = '';
      let fileSize = 0;
      let writeStream: fs.WriteStream | null = null;
      let uploadedSize = 0;

      // 处理表单字段
      busboy.on('field', (fieldname: string, value: string) => {
        if (fieldname === 'fileName') {
          fileName = value;
        } else if (fieldname === 'targetId') {
          targetId = value;
        }
      });

      // 处理文件流
      busboy.on('file', (fieldname: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
        if (!fileName) {
          fileName = info.filename;
        }
        
        filePath = this.getUniqueFilePath(fileName);
        writeStream = fs.createWriteStream(filePath);
        
        // 监听文件流数据
        file.on('data', (chunk: Buffer) => {
          uploadedSize += chunk.length;
          fileSize = uploadedSize;
          
          // 发送上传进度（每 100KB 发送一次）
          if (uploadedSize % (100 * 1024) < chunk.length) {
            const percent = fileSize > 0 ? Math.round((uploadedSize / fileSize) * 100) : 0;
            this.emit('upload-progress', { 
              name: fileName, 
              percent, 
              sentSize: uploadedSize, 
              totalSize: fileSize 
            });
            
            // 通知客户端上传进度
            if (client && client.socket.connected) {
              client.socket.emit('upload-progress', {
                fileName,
                percent,
                sentSize: uploadedSize,
                totalSize: fileSize
              });
            }
          }
        });

        // 将文件流写入磁盘
        file.pipe(writeStream);

        file.on('end', () => {
          console.log(`[Upload] File stream ended: ${fileName}, size: ${fileSize}`);
        });
      });

      // 所有数据处理完成
      busboy.on('finish', () => {
        if (!fileName || !filePath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid file data' }));
          return;
        }

        // 等待写入流完成
        if (writeStream) {
          writeStream.end(() => {
            // 如果目标是其他设备，共享文件
            if (targetId !== 'host') {
              const targetClient = this.clients.get(targetId);
              if (targetClient && targetClient.socket.connected) {
                const fileId = this.shareFile(filePath, targetId);
                const downloadUrl = `${this.getURL()}/download/${targetId}/${fileId}`;
                targetClient.socket.emit('file-received', {
                  fileName,
                  fileSize,
                  filePath: downloadUrl,
                  from: clientName
                });
                this.emit('file-relayed', { name: fileName, size: fileSize, from: clientName, to: targetClient.name, fileId });
              } else {
                console.log(`[Upload] Target client ${targetId} not found or not connected`);
              }
            } else {
              // 发送到桌面端
              this.emit('upload-complete', { 
                name: fileName, 
                size: fileSize, 
                filePath, 
                clientId, 
                clientName, 
                targetId 
              });
            }

            // 通知上传成功
            if (client && client.socket.connected) {
              client.socket.emit('upload-complete', { 
                fileName 
              });
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, fileName }));
          });
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No file received' }));
        }
      });

      busboy.on('error', (err: Error) => {
        console.error('[Upload] Busboy error:', err);
        
        // 清理写入流
        if (writeStream) {
          writeStream.end();
          writeStream = null;
        }
        
        // 删除部分上传的文件
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Upload failed' }));
        
        // 通知客户端上传失败
        if (client && client.socket.connected) {
          client.socket.emit('upload-error', { 
            error: 'Upload failed' 
          });
        }
      });

      // 将请求流传递给 busboy
      req.pipe(busboy);

    } catch (error) {
      console.error('[Upload] Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Upload failed' }));
    }
  }

  private getFilesForClient(clientId: string) {
    const files: { id: string; name: string; size: number }[] = [];
    for (const [id, info] of this.sharedFiles.entries()) {
      if (info.targetClientId === null || info.targetClientId === clientId) {
        if (fs.existsSync(info.filePath)) {
          files.push({ id, name: path.basename(info.filePath), size: fs.statSync(info.filePath).size });
        }
      }
    }
    return files;
  }

  private handleDownload(clientId: string, fileId: string, res: http.ServerResponse) {
    console.log(`[Download] Request - clientId: ${clientId}, fileId: ${fileId}`);
    
    const info = this.sharedFiles.get(fileId);
    
    if (!info) {
      console.log(`[Download] File ID not found in sharedFiles map`);
      console.log(`[Download] Available fileIds:`, Array.from(this.sharedFiles.keys()));
      res.writeHead(404);
      return res.end('File index expired or not found');
    }
    
    console.log(`[Download] File info - path: ${info.filePath}, targetClientId: ${info.targetClientId}`);
    
    // 检查磁盘文件
    if (!fs.existsSync(info.filePath)) {
      console.log(`[Download] File does not exist on disk: ${info.filePath}`);
      res.writeHead(404);
      return res.end('File missing on disk');
    }
    
    // 权限检查：如果指定了目标客户端，只允许该客户端下载
    if (info.targetClientId !== null && info.targetClientId !== clientId) {
      console.log(`[Download] Access denied - targetClientId: ${info.targetClientId}, requestClientId: ${clientId}`);
      res.writeHead(403);
      return res.end('Access denied');
    }

    const stat = fs.statSync(info.filePath);
    const fileName = path.basename(info.filePath);
    
    console.log(`[Download] Serving file: ${fileName}, size: ${stat.size} bytes`);
    
    // 设置响应头 - 必须在写入数据前设置
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*',
      // 必须暴露这些头，否则前端 fetch 拿不到
      'Access-Control-Expose-Headers': 'Content-Length, Content-Disposition'
    });

    const readStream = fs.createReadStream(info.filePath);
    
    let bytesSent = 0;
    readStream.on('data', (chunk) => {
      bytesSent += chunk.length;
    });
    
    // 错误处理：防止流读取失败导致连接挂起
    readStream.on('error', (err) => {
      console.error('[Download] Stream error:', err);
      if (!res.headersSent) {
        res.writeHead(500);
      }
      res.end();
    });
    
    // 核心：泵入数据
    readStream.pipe(res);
    
    // 传输完成后的处理
    res.on('finish', () => {
      console.log(`[Download] Finished sending: ${fileName}, bytes sent: ${bytesSent}`);
      this.emit('file-downloaded', { id: fileId, name: fileName, size: stat.size, clientId });
      
      // 延迟删除文件 ID，允许重复下载
      setTimeout(() => {
        if (this.sharedFiles.has(fileId)) {
          this.sharedFiles.delete(fileId);
          console.log(`[Download] Removed fileId from sharedFiles: ${fileId}`);
          if (info.targetClientId) {
            this.notifyClient(info.targetClientId);
          }
        }
      }, 60000); // 60 秒后删除
    });
  }

  shareFile(filePath: string, targetClientId: string | null = null): string {
    const id = Math.random().toString(36).slice(2, 10);
    this.sharedFiles.set(id, { filePath, targetClientId });
    
    console.log(`[shareFile] Sharing file: ${filePath}, target: ${targetClientId}, fileId: ${id}`);
    
    // 如果指定了目标客户端，直接发送文件通知
    if (targetClientId) {
      const targetClient = this.clients.get(targetClientId);
      console.log(`[shareFile] Target client found: ${!!targetClient}, Socket connected: ${targetClient?.socket.connected}`);
      
      if (targetClient && targetClient.socket.connected) {
        const fileName = path.basename(filePath);
        let fileSize = 0;
        
        try {
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            fileSize = stats.size;
            console.log(`[shareFile] File size: ${fileSize} bytes`);
          } else {
            console.error(`[shareFile] File not found: ${filePath}`);
          }
        } catch (error) {
          console.error(`[shareFile] Error getting file stats:`, error);
        }
        
        // 使用相对路径，避免混合内容问题
        const downloadUrl = `/download/${targetClientId}/${id}`;
        
        const message = {
          fileName,
          fileSize,
          filePath: downloadUrl,
          from: this.deviceName
        };
        
        console.log(`[shareFile] Sending message:`, message);
        
        try {
          targetClient.socket.emit('file-received', message);
          console.log(`[File] Sent file notification to client ${targetClientId}: ${fileName} (${fileSize} bytes)`);
        } catch (error) {
          console.error(`[shareFile] Error sending Socket.IO message:`, error);
        }
        
        return id;
      } else {
        console.log(`[File] Target client ${targetClientId} not found or not connected, adding to shared list`);
      }
    }
    
    // 如果没有指定目标或目标不在线，通知所有客户端
    if (targetClientId) {
      this.notifyClient(targetClientId);
    } else {
      this.notifyAllClients();
    }
    return id;
  }

  unshareFile(id: string) {
    const info = this.sharedFiles.get(id);
    this.sharedFiles.delete(id);
    if (info?.targetClientId) {
      this.notifyClient(info.targetClientId);
    } else {
      this.notifyAllClients();
    }
  }

  shareText(text: string, targetClientId: string | null = null): string {
    const id = Math.random().toString(36).slice(2, 10);
    
    // 如果指定了目标客户端，直接发送文本消息
    if (targetClientId) {
      const targetClient = this.clients.get(targetClientId);
      if (targetClient && targetClient.socket.connected) {
        targetClient.socket.emit('text-received', {
          id,
          text,
          from: this.deviceName
        });
        console.log(`[Text] Sent text to client ${targetClientId}`);
        return id;
      } else {
        console.log(`[Text] Target client ${targetClientId} not found or not connected, adding to shared list`);
      }
    }
    
    // 如果没有指定目标或目标不在线，添加到共享列表
    this.sharedTexts.set(id, { text, targetClientId, timestamp: Date.now() });
    if (targetClientId) {
      this.notifyClient(targetClientId);
    } else {
      this.notifyAllClients();
    }
    return id;
  }

  unshareText(id: string) {
    const info = this.sharedTexts.get(id);
    this.sharedTexts.delete(id);
    if (info?.targetClientId) {
      this.notifyClient(info.targetClientId);
    } else {
      this.notifyAllClients();
    }
  }

  private getTextsForClient(clientId: string) {
    const texts: { id: string; text: string; preview: string }[] = [];
    for (const [id, info] of this.sharedTexts.entries()) {
      if (info.targetClientId === null || info.targetClientId === clientId) {
        texts.push({ id, text: info.text, preview: info.text.slice(0, 50) + (info.text.length > 50 ? '...' : '') });
      }
    }
    return texts;
  }

  private notifyClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client && client.socket.connected) {
      const files = this.getFilesForClient(clientId);
      const texts = this.getTextsForClient(clientId);
      client.socket.emit('files-updated', { files, texts });
    }
  }

  private notifyAllClients() {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.socket.connected) {
        const files = this.getFilesForClient(clientId);
        const texts = this.getTextsForClient(clientId);
        client.socket.emit('files-updated', { files, texts });
      }
    }
  }

  private handleSocketConnection(socket: Socket) {
    const ip = (socket.handshake.address || '').replace('::ffff:', '');
    
    let clientId = '';
    let clientName = `手机 ${ip.split('.').pop()}`;
    let isReconnect = false;
    
    // 检查是否是重连（相同 IP 且 Socket 仍然连接）
    for (const [id, existingClient] of this.clients.entries()) {
      if (existingClient.ip === ip && existingClient.socket.connected) {
        clientId = id;
        clientName = existingClient.name;
        isReconnect = true;
        console.log(`[WebServer] Client reconnecting: ${clientId} (${ip})`);
        existingClient.socket.disconnect();
        break;
      }
    }
    
    // 清理相同 IP 的断开连接的客户端
    for (const [id, existingClient] of this.clients.entries()) {
      if (existingClient.ip === ip && !existingClient.socket.connected) {
        console.log(`[WebServer] Removing disconnected client with same IP: ${id}`);
        this.clients.delete(id);
      }
    }
    
    if (!clientId) {
      clientId = uuidv4();
      console.log(`[WebServer] New client connecting: ${clientId} (${ip})`);
    }

    const client: MobileClient = { 
      id: clientId, 
      name: clientName, 
      model: '', 
      socket, 
      ip, 
      connectedAt: Date.now() 
    };
    this.clients.set(clientId, client);

    // 发送连接成功消息
    socket.emit('connected', { 
      clientId, 
      deviceName: this.deviceName, 
      appVersion: app.getVersion() 
    });
    
    // 发送待下载的文件和文本
    const files = this.getFilesForClient(clientId);
    const texts = this.getTextsForClient(clientId);
    if (files.length > 0 || texts.length > 0) {
      socket.emit('files-updated', { files, texts });
    }
    
    // 发送设备列表
    socket.emit('devices-updated', { devices: this.getDeviceListForMobile(clientId) });

    // 总是触发 client-connected 事件，确保 Desktop 端能收到通知
    this.emit('client-connected', { id: clientId, name: clientName, ip });
    this.broadcastDeviceList();

    // 设置设备名称
    socket.on('set-name', (data: { name: string; model?: string }) => {
      clientName = data.name || clientName;
      client.name = clientName;
      if (data.model) client.model = data.model;
      this.emit('client-updated', { id: clientId, name: clientName, model: client.model, ip });
      this.broadcastDeviceList();
    });

    // 获取设备列表
    socket.on('get-devices', () => {
      const devices = this.getDeviceListForMobile(clientId);
      console.log(`[WebServer] Client ${clientId} requested devices, sending:`, devices);
      socket.emit('devices-updated', { devices });
    });

    // 发送文本
    socket.on('send-text', (data: { text: string; targetId?: string }) => {
      const targetId = data.targetId || 'host';
      if (targetId === 'host') {
        this.emit('text-received', { text: data.text, clientId, clientName });
        socket.emit('text-received');
      } else {
        const targetClient = this.clients.get(targetId);
        if (targetClient && targetClient.socket.connected) {
          targetClient.socket.emit('text-from-mobile', { 
            text: data.text, 
            from: clientName,
            fromId: clientId
          });
          socket.emit('text-received');
          this.emit('text-relayed', { text: data.text, from: clientName, to: targetClient.name });
        } else {
          socket.emit('error', { message: '目标设备不在线' });
        }
      }
    });

    // 复制文本
    socket.on('copy-text', (data: { id: string }) => {
      const textInfo = this.sharedTexts.get(data.id);
      if (textInfo) {
        this.emit('text-copied', { id: data.id, text: textInfo.text, clientId });
        this.sharedTexts.delete(data.id);
        this.notifyClient(clientId);
      }
    });

    // 下载失败通知
    socket.on('download-failed', (data: { fileName: string; filePath: string }) => {
      this.emit('download-failed', { 
        fileName: data.fileName, 
        filePath: data.filePath,
        clientId, 
        clientName 
      });
    });

    // 下载进度同步（移动端 -> 桌面端）
    socket.on('download-progress-sync', (data: { itemId: string; fileName: string; percent: number; receivedSize: number; totalSize: number }) => {
      console.log(`[WebServer] Mobile download progress: ${data.fileName} ${data.percent}%`);
      // 转发给桌面端（通过主进程事件）
      this.emit('mobile-download-progress', {
        clientId,
        clientName,
        ...data
      });
    });

    // 上传进度同步（移动端 -> 桌面端）
    socket.on('upload-progress-sync', (data: { fileName: string; percent: number; sentSize: number; totalSize: number }) => {
      console.log(`[WebServer] Mobile upload progress: ${data.fileName} ${data.percent}%`);
      // 转发给桌面端（通过主进程事件）
      this.emit('mobile-upload-progress', {
        clientId,
        clientName,
        ...data
      });
    });

    // 文件传输（使用 Socket.IO 的二进制支持）
    let currentFileName = '';
    let currentFileSize = 0;
    let currentFilePath = '';
    let receivedSize = 0;
    let writeStream: fs.WriteStream | null = null;
    let targetDeviceId = 'host';

    socket.on('file-start', (data: { name: string; size: number; targetId?: string }) => {
      currentFileName = data.name;
      currentFileSize = data.size;
      targetDeviceId = data.targetId || 'host';
      receivedSize = 0;
      currentFilePath = this.getUniqueFilePath(currentFileName);
      writeStream = fs.createWriteStream(currentFilePath);
      this.emit('upload-start', { 
        name: currentFileName, 
        size: currentFileSize, 
        clientId, 
        clientName, 
        targetId: targetDeviceId 
      });
      socket.emit('ready');
    });

    socket.on('file-chunk', (chunk: Buffer) => {
      if (writeStream) {
        writeStream.write(chunk);
        receivedSize += chunk.length;
        const percent = Math.round((receivedSize / currentFileSize) * 100);
        this.emit('upload-progress', { 
          name: currentFileName, 
          percent, 
          receivedSize, 
          totalSize: currentFileSize 
        });
        
        // 发送进度给客户端
        socket.emit('upload-progress', {
          fileName: currentFileName,
          percent,
          sentSize: receivedSize,
          totalSize: currentFileSize
        });
      }
    });

    socket.on('file-end', () => {
      writeStream?.close();
      writeStream = null;
      
      if (targetDeviceId !== 'host') {
        const targetClient = this.clients.get(targetDeviceId);
        if (targetClient) {
          const fileId = this.shareFile(currentFilePath, targetDeviceId);
          this.emit('file-relayed', { 
            name: currentFileName, 
            size: currentFileSize, 
            from: clientName, 
            to: targetClient.name, 
            fileId 
          });
        }
      }
      
      this.emit('upload-complete', { 
        name: currentFileName, 
        size: currentFileSize, 
        filePath: currentFilePath, 
        clientId, 
        clientName, 
        targetId: targetDeviceId 
      });
      socket.emit('upload-complete', { fileName: currentFileName });
    });

    // 断开连接
    socket.on('disconnect', () => {
      writeStream?.close();
      const currentClient = this.clients.get(clientId);
      if (currentClient && currentClient.socket === socket) {
        this.clients.delete(clientId);
        this.emit('client-disconnected', { id: clientId, name: clientName, ip });
        this.broadcastDeviceList();
      }
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

  private serveHTML(res: http.ServerResponse) {
    // 直接使用生产模式的 HTML
    this.serveProductionHTML(res);
  }

  private proxyToVite(req: http.IncomingMessage, res: http.ServerResponse) {
    const viteDevUrl = `http://localhost:5174${req.url}`;
    
    http.get(viteDevUrl, (viteRes) => {
      res.writeHead(viteRes.statusCode || 200, viteRes.headers);
      viteRes.pipe(res);
    }).on('error', (err) => {
      console.error('Vite proxy error:', err.message);
      res.writeHead(502);
      res.end('Vite dev server not available');
    });
  }

  private serveProductionHTML(res: http.ServerResponse) {
    // __dirname 在编译后是 dist/main/main/services
    // 需要向上到 dist/main/templates
    const reactTemplatePath = path.join(__dirname, '../../templates/mobile-web.html');
    
    console.log('[WebServer] Looking for template at:', reactTemplatePath);
    console.log('[WebServer] __dirname:', __dirname);
    console.log('[WebServer] File exists:', fs.existsSync(reactTemplatePath));
    
    if (!fs.existsSync(reactTemplatePath)) {
      res.writeHead(404);
      res.end('Template not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(reactTemplatePath).pipe(res);
  }

  stop() {
    this.io?.close();
    this.httpServer?.close();
    this.sharedFiles.clear();
    this.clients.clear();
  }
}
