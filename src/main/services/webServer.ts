import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { networkInterfaces } from 'os';
import { v4 as uuidv4 } from 'uuid';

interface MobileClient {
  id: string;
  name: string;
  ws: WebSocket;
  ip: string;
  connectedAt: number;
}

interface SharedFileInfo {
  filePath: string;
  targetClientId: string | null; // null = 所有人可见, 否则只有指定客户端可见
}

interface SharedText {
  text: string;
  targetClientId: string | null;
  timestamp: number;
}

// 局域网设备（电脑）
interface LANDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
  type: 'pc';
}

export class WebFileServer extends EventEmitter {
  private httpServer: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private downloadPath: string;
  private deviceName: string;
  private port: number = 8080;
  private sharedFiles: Map<string, SharedFileInfo> = new Map(); // fileId -> SharedFileInfo
  private clients: Map<string, MobileClient> = new Map(); // clientId -> MobileClient
  private sharedTexts: Map<string, SharedText> = new Map(); // textId -> SharedText
  private lanDevices: Map<string, LANDevice> = new Map(); // 局域网内的其他电脑

  constructor(downloadPath: string, deviceName: string) {
    super();
    this.downloadPath = downloadPath;
    this.deviceName = deviceName;
  }

  // 更新局域网设备列表（由 main.ts 调用）
  updateLANDevice(device: LANDevice) {
    this.lanDevices.set(device.id, device);
    this.broadcastDeviceList();
  }

  removeLANDevice(deviceId: string) {
    this.lanDevices.delete(deviceId);
    this.broadcastDeviceList();
  }

  // 广播设备列表给所有手机
  private broadcastDeviceList() {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        // 每个手机收到的列表排除自己
        const devices = this.getDeviceListForMobile(clientId);
        client.ws.send(JSON.stringify({ type: 'devices-updated', devices }));
      }
    }
  }

  // 获取手机可见的设备列表（当前电脑 + 局域网电脑 + 其他手机）
  private getDeviceListForMobile(excludeClientId?: string) {
    const devices: { id: string; name: string; ip: string; type: 'pc' | 'mobile' }[] = [];
    // 当前电脑（自己）- 放在第一位
    devices.push({ id: 'host', name: this.deviceName, ip: this.getLocalIP(), type: 'pc' });
    // 局域网内的其他电脑（暂时不支持直接发送，仅展示）
    // for (const device of this.lanDevices.values()) {
    //   devices.push({ id: device.id, name: device.name, ip: device.ip, type: 'pc' });
    // }
    // 其他已连接的手机
    for (const [id, client] of this.clients.entries()) {
      if (id !== excludeClientId) {
        devices.push({ id, name: client.name, ip: client.ip, type: 'mobile' });
      }
    }
    return devices;
  }

  setDownloadPath(p: string) { this.downloadPath = p; }

  async start(preferredPort: number = 8080): Promise<number> {
    this.port = preferredPort;
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => this.handleRequest(req, res));
      this.httpServer.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') { 
          this.port++; 
          this.httpServer?.listen(this.port); 
        } else {
          reject(err);
        }
      });
      this.httpServer.listen(this.port, '0.0.0.0', () => {
        this.wss = new WebSocketServer({ server: this.httpServer! });
        this.wss.on('connection', (ws, req) => this.handleWebSocket(ws, req));
        console.log(`Web server started on port ${this.port}`);
        resolve(this.port);
      });
    });
  }

  getLocalIP(): string {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) return net.address;
      }
    }
    return '127.0.0.1';
  }

  getURL(): string { 
    return `http://${this.getLocalIP()}:${this.port}`; 
  }

  // 获取已连接的手机列表
  getConnectedClients(): { id: string; name: string; ip: string }[] {
    return Array.from(this.clients.values()).map(c => ({ id: c.id, name: c.name, ip: c.ip }));
  }

  // 从请求IP获取对应的clientId
  private getClientIdFromRequest(req: http.IncomingMessage): string {
    const ip = (req.socket.remoteAddress || '').replace('::ffff:', '');
    for (const [clientId, client] of this.clients.entries()) {
      if (client.ip === ip) return clientId;
    }
    return '';
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = req.url || '/';
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    if (url === '/' || url === '/index.html') {
      this.serveHTML(res);
    } else if (url.startsWith('/api/info/')) {
      const clientId = url.replace('/api/info/', '');
      this.handleApiInfo(clientId, res);
    } else if (url.startsWith('/download/')) {
      const parts = url.replace('/download/', '').split('/');
      if (parts.length === 2) {
        // /download/clientId/fileId
        this.handleDownload(parts[0], parts[1], res);
      } else if (parts.length === 1) {
        // /download/fileId (兼容旧格式，从请求中获取clientId)
        const clientId = this.getClientIdFromRequest(req);
        this.handleDownload(clientId, parts[0], res);
      } else {
        res.writeHead(404); res.end('Invalid download URL');
      }
    } else {
      res.writeHead(404); res.end('Not Found');
    }
  }

  private handleApiInfo(clientId: string, res: http.ServerResponse) {
    const files = this.getFilesForClient(clientId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ deviceName: this.deviceName, files }));
  }

  private getFilesForClient(clientId: string) {
    const files: { id: string; name: string; size: number }[] = [];
    for (const [id, info] of this.sharedFiles.entries()) {
      // 只返回给所有人的文件或指定给该客户端的文件
      if (info.targetClientId === null || info.targetClientId === clientId) {
        if (fs.existsSync(info.filePath)) {
          files.push({ id, name: path.basename(info.filePath), size: fs.statSync(info.filePath).size });
        }
      }
    }
    return files;
  }

  private handleDownload(clientId: string, fileId: string, res: http.ServerResponse) {
    const info = this.sharedFiles.get(fileId);
    if (!info || !fs.existsSync(info.filePath)) {
      res.writeHead(404); res.end('File not found'); return;
    }
    // 检查权限
    if (info.targetClientId !== null && info.targetClientId !== clientId) {
      res.writeHead(403); res.end('Access denied'); return;
    }

    const stat = fs.statSync(info.filePath);
    const fileName = path.basename(info.filePath);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Content-Length': stat.size
    });

    const readStream = fs.createReadStream(info.filePath);
    readStream.pipe(res);
    readStream.on('end', () => {
      this.emit('file-downloaded', { id: fileId, name: fileName, size: stat.size, clientId });
      this.sharedFiles.delete(fileId);
      this.notifyClient(clientId);
    });
  }

  // 分享文件给指定手机（targetClientId 为 null 则所有人可见）
  shareFile(filePath: string, targetClientId: string | null = null): string {
    const id = Math.random().toString(36).slice(2, 10);
    this.sharedFiles.set(id, { filePath, targetClientId });
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

  // 分享文本给指定手机
  shareText(text: string, targetClientId: string | null = null): string {
    const id = Math.random().toString(36).slice(2, 10);
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
    if (client && client.ws.readyState === WebSocket.OPEN) {
      const files = this.getFilesForClient(clientId);
      const texts = this.getTextsForClient(clientId);
      client.ws.send(JSON.stringify({ type: 'files-updated', files, texts }));
    }
  }

  private notifyAllClients() {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        const files = this.getFilesForClient(clientId);
        const texts = this.getTextsForClient(clientId);
        client.ws.send(JSON.stringify({ type: 'files-updated', files, texts }));
      }
    }
  }

  private handleWebSocket(ws: WebSocket, req: http.IncomingMessage) {
    const ip = (req.socket.remoteAddress || '').replace('::ffff:', '');
    
    // 检查是否已有同 IP 的客户端，如果有则复用或替换
    let clientId = '';
    let clientName = `手机 ${ip.split('.').pop()}`;
    let isReconnect = false;
    let oldWs: WebSocket | null = null;
    
    for (const [id, existingClient] of this.clients.entries()) {
      if (existingClient.ip === ip) {
        // 同 IP 设备重新连接，复用 ID 和名称
        clientId = id;
        clientName = existingClient.name;
        isReconnect = true;
        oldWs = existingClient.ws;
        break;
      }
    }
    
    if (!clientId) {
      clientId = uuidv4();
    }

    const client: MobileClient = { id: clientId, name: clientName, ws, ip, connectedAt: Date.now() };
    this.clients.set(clientId, client);

    // 关闭旧连接（在新连接已设置后再关闭，避免 close 事件删除新记录）
    if (oldWs && oldWs.readyState === WebSocket.OPEN) {
      oldWs.close();
    }

    // 发送客户端ID和当前文件列表
    ws.send(JSON.stringify({ type: 'connected', clientId, deviceName: this.deviceName }));
    const files = this.getFilesForClient(clientId);
    const texts = this.getTextsForClient(clientId);
    if (files.length > 0 || texts.length > 0) {
      ws.send(JSON.stringify({ type: 'files-updated', files, texts }));
    }
    // 发送设备列表
    ws.send(JSON.stringify({ type: 'devices-updated', devices: this.getDeviceListForMobile(clientId) }));

    // 通知前端有新手机连接（重连时更新）
    if (isReconnect) {
      this.emit('client-updated', { id: clientId, name: clientName, ip });
    } else {
      this.emit('client-connected', { id: clientId, name: clientName, ip });
      // 新手机连接后，通知其他手机更新设备列表
      this.broadcastDeviceList();
    }

    let currentFileName = '';
    let currentFileSize = 0;
    let currentFilePath = '';
    let receivedSize = 0;
    let writeStream: fs.WriteStream | null = null;
    let targetDeviceId = 'host'; // 默认发送给当前电脑

    ws.on('message', (data: Buffer, isBinary: boolean) => {
      if (!isBinary) {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'set-name') {
            clientName = msg.name || clientName;
            client.name = clientName;
            this.emit('client-updated', { id: clientId, name: clientName, ip });
            // 名称更新后通知其他手机
            this.broadcastDeviceList();
          } else if (msg.type === 'get-devices') {
            // 手机请求设备列表
            ws.send(JSON.stringify({ type: 'devices-updated', devices: this.getDeviceListForMobile(clientId) }));
          } else if (msg.type === 'file-start') {
            currentFileName = msg.name;
            currentFileSize = msg.size;
            targetDeviceId = msg.targetId || 'host';
            receivedSize = 0;
            currentFilePath = this.getUniqueFilePath(currentFileName);
            writeStream = fs.createWriteStream(currentFilePath);
            this.emit('upload-start', { name: currentFileName, size: currentFileSize, clientId, clientName, targetId: targetDeviceId });
            ws.send(JSON.stringify({ type: 'ready' }));
          } else if (msg.type === 'file-end') {
            writeStream?.close();
            writeStream = null;
            
            // 如果目标是其他手机，则中转文件
            if (targetDeviceId !== 'host') {
              const targetClient = this.clients.get(targetDeviceId);
              if (targetClient) {
                // 分享文件给目标手机
                const fileId = this.shareFile(currentFilePath, targetDeviceId);
                this.emit('file-relayed', { name: currentFileName, size: currentFileSize, from: clientName, to: targetClient.name, fileId });
              }
            }
            
            this.emit('upload-complete', { name: currentFileName, size: currentFileSize, filePath: currentFilePath, clientId, clientName, targetId: targetDeviceId });
            ws.send(JSON.stringify({ type: 'complete', name: currentFileName }));
          } else if (msg.type === 'send-text') {
            const targetId = msg.targetId || 'host';
            if (targetId === 'host') {
              // 发送给当前电脑
              this.emit('text-received', { text: msg.text, clientId, clientName });
              ws.send(JSON.stringify({ type: 'text-received' }));
            } else {
              // 发送给其他手机（中转）
              const targetClient = this.clients.get(targetId);
              if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
                // 直接推送给目标手机
                targetClient.ws.send(JSON.stringify({ 
                  type: 'text-from-mobile', 
                  text: msg.text, 
                  from: clientName,
                  fromId: clientId
                }));
                ws.send(JSON.stringify({ type: 'text-received' }));
                this.emit('text-relayed', { text: msg.text, from: clientName, to: targetClient.name });
              } else {
                ws.send(JSON.stringify({ type: 'error', message: '目标设备不在线' }));
              }
            }
          } else if (msg.type === 'copy-text') {
            // 手机复制了分享的文本
            const textInfo = this.sharedTexts.get(msg.id);
            if (textInfo) {
              this.emit('text-copied', { id: msg.id, text: textInfo.text, clientId });
              this.sharedTexts.delete(msg.id);
              this.notifyClient(clientId);
            }
          }
          return;
        } catch { /* Binary data */ }
      }
      if (writeStream) {
        writeStream.write(data);
        receivedSize += data.length;
        const percent = Math.round((receivedSize / currentFileSize) * 100);
        this.emit('upload-progress', { name: currentFileName, percent, receivedSize, totalSize: currentFileSize });
      }
    });

    ws.on('close', () => {
      writeStream?.close();
      // 只有当前 ws 仍是该客户端的活动连接时才删除和通知
      const currentClient = this.clients.get(clientId);
      if (currentClient && currentClient.ws === ws) {
        this.clients.delete(clientId);
        this.emit('client-disconnected', { id: clientId, name: clientName, ip });
        // 通知其他手机更新设备列表
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
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#0a0a0c">
  <title>Airdrop</title>
  <style>
    :root {
      --bg-gradient: linear-gradient(180deg, #0a0a0c 0%, #12121a 100%);
      --bg-card: rgba(255,255,255,0.03);
      --border-card: rgba(255,255,255,0.06);
      --text-primary: #fff;
      --text-secondary: #a0a0a8;
      --text-muted: #6b6b74;
      --accent: #3b82f6;
      --accent-light: #60a5fa;
    }
    [data-theme="light"] {
      --bg-gradient: linear-gradient(180deg, #f5f7fa 0%, #e8ecf1 100%);
      --bg-card: #ffffff;
      --border-card: #e0e4e8;
      --text-primary: #1a1a1a;
      --text-secondary: #4a4a4a;
      --text-muted: #6b7280;
      --accent: #2563eb;
      --accent-light: #3b82f6;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', sans-serif; background: var(--bg-gradient); min-height: 100vh; color: var(--text-primary); padding: 16px; padding-top: max(16px, env(safe-area-inset-top)); padding-bottom: max(16px, env(safe-area-inset-bottom)); }
    .container { max-width: 420px; margin: 0 auto; }
    
    .header { text-align: center; padding: 20px 0 16px; margin-bottom: 20px; }
    .logo { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px; }
    .logo svg { width: 28px; height: 28px; color: var(--accent); filter: drop-shadow(0 0 8px rgba(59,130,246,0.4)); }
    h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .device-info { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
    .device-info-left { display: flex; align-items: center; gap: 8px; }
    .device-info-right { display: flex; align-items: center; }
    .device-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); padding: 6px 12px; border-radius: 20px; font-size: 12px; color: var(--accent-light); }
    .device-badge svg { width: 14px; height: 14px; }
    .status-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: #22c55e; }
    .status-badge::before { content: ''; width: 6px; height: 6px; background: #22c55e; border-radius: 50%; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    
    .my-device { background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 16px; padding: 14px 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; }
    .my-avatar { width: 40px; height: 40px; background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
    .my-info { flex: 1; }
    .my-name { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; color: var(--text-primary); }
    .my-model { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    .edit-btn { background: none; border: none; color: var(--text-muted); padding: 8px; cursor: pointer; border-radius: 8px; }
    .edit-btn:active { background: var(--bg-card); }
    
    .theme-switcher { display: flex; background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 10px; padding: 3px; gap: 2px; }
    .theme-btn { display: flex; align-items: center; justify-content: center; width: 32px; height: 28px; background: transparent; border: none; border-radius: 7px; color: var(--text-muted); cursor: pointer; transition: all 0.15s; }
    .theme-btn svg { width: 16px; height: 16px; }
    .theme-btn.active { background: rgba(255,255,255,0.1); color: var(--text-primary); }
    [data-theme="light"] .theme-btn.active { background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    
    .section { margin-bottom: 20px; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .section-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
    .section-count { font-size: 11px; color: var(--text-muted); }
    
    .card { background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 16px; overflow: hidden; }
    .download-card { min-height: auto; }
    .drop-zone { min-height: 140px; padding: 24px 20px; text-align: center; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .drop-zone.active { background: rgba(59,130,246,0.08); border-color: rgba(59,130,246,0.3); }
    .drop-icon { width: 48px; height: 48px; margin: 0 auto 12px; background: rgba(59,130,246,0.1); border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .drop-icon svg { width: 22px; height: 22px; color: var(--accent); }
    .drop-text { color: var(--text-muted); font-size: 13px; margin-bottom: 8px; }
    .drop-hint { font-size: 11px; color: var(--text-muted); opacity: 0.7; }
    
    .file-input { display: none; }
    .file-card { overflow: visible; }
    .file-list-container { padding: 12px 16px; }
    .file-list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; font-size: 13px; color: var(--text-secondary); }
    .btn-clear-files { background: none; border: none; color: #ef4444; font-size: 13px; font-weight: 500; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
    .btn-clear-files:active { background: rgba(239,68,68,0.1); }
    .file-list { background: rgba(0,0,0,0.05); border-radius: 12px; max-height: 200px; overflow-y: auto; }
    [data-theme="light"] .file-list { background: rgba(0,0,0,0.03); }
    .file-item { padding: 10px 14px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border-card); }
    .file-item:last-child { border-bottom: none; }
    .file-icon { width: 32px; height: 32px; min-width: 32px; background: rgba(59,130,246,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .file-icon svg { width: 16px; height: 16px; color: var(--accent); flex-shrink: 0; }
    .file-info { flex: 1; min-width: 0; overflow: hidden; }
    .file-name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; color: var(--text-primary); }
    .file-size { font-size: 11px; color: var(--text-muted); margin-top: 2px; display: block; }
    .file-remove { background: none; border: none; color: var(--text-muted); width: 28px; height: 28px; min-width: 28px; cursor: pointer; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .file-remove:active { background: rgba(239,68,68,0.1); color: #ef4444; }
    .btn-add-more { background: none; border: none; color: var(--accent); font-size: 13px; font-weight: 500; cursor: pointer; padding: 10px; width: 100%; text-align: left; }
    .btn-add-more:active { background: rgba(59,130,246,0.1); }
    .progress-bar { height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 6px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #60a5fa); transition: width 0.2s; }
    
    .btn { width: 100%; padding: 14px; border: none; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-primary { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #fff; box-shadow: 0 4px 12px rgba(59,130,246,0.3); }
    .btn-primary:active { transform: scale(0.98); }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
    .btn-download { background: linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.1) 100%); border: 1px solid rgba(34,197,94,0.25); color: #4ade80; width: auto; padding: 6px 14px; font-size: 13px; font-weight: 500; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; flex-shrink: 0; }
    .btn-download:active { background: rgba(34,197,94,0.25); transform: scale(0.96); }
    .btn-download svg { width: 14px; height: 14px; }
    
    .status { text-align: center; padding: 10px 16px; border-radius: 10px; font-size: 12px; margin-top: 12px; }
    .status.success { color: #22c55e; background: rgba(34,197,94,0.1); }
    .status.error { color: #ef4444; background: rgba(239,68,68,0.1); }
    .status.info { color: #3b82f6; background: rgba(59,130,246,0.1); }
    
    .download-section { display: none; }
    .download-section.show { display: block; }
    .download-item { padding: 14px 16px; display: flex; align-items: center; gap: 12px; }
    .download-item + .download-item { border-top: 1px solid rgba(255,255,255,0.04); }
    
    .device-list { display: flex; flex-direction: row; gap: 10px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
    .device-list::-webkit-scrollbar { display: none; }
    .device-item { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 16px; width: 100px; min-width: 100px; max-width: 100px; background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 14px; cursor: pointer; transition: all 0.15s; flex-shrink: 0; position: relative; }
    .device-item:active { transform: scale(0.96); }
    .device-item.selected { background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.3); }
    .device-avatar { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .device-avatar svg { width: 20px; height: 20px; }
    .device-avatar.pc { background: rgba(59,130,246,0.15); color: #60a5fa; }
    .device-avatar.mobile { background: rgba(168,85,247,0.15); color: #c084fc; }
    .device-item-info { text-align: center; }
    .device-item-name { font-size: 12px; font-weight: 500; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px; color: var(--text-primary); }
    .device-item-type { font-size: 9px; color: var(--text-muted); display: none; }
    .device-check { position: absolute; top: 6px; right: 6px; width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid var(--border-card); display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(0,0,0,0.2); }
    [data-theme="light"] .device-check { background: rgba(0,0,0,0.05); }
    .device-check svg { width: 10px; height: 10px; display: none; }
    .device-item.selected .device-check { background: #3b82f6; border-color: #3b82f6; }
    .device-item.selected .device-check svg { display: block; color: #fff; }
    
    .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); z-index: 100; align-items: center; justify-content: center; padding: 20px; }
    .modal.show { display: flex; }
    .modal-content { background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 20px; padding: 24px; width: 100%; max-width: 320px; }
    [data-theme="dark"] .modal-content { background: #18181c; }
    .modal-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; text-align: center; color: var(--text-primary); }
    .modal-input { width: 100%; padding: 14px 16px; background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 12px; color: var(--text-primary); font-size: 15px; outline: none; }
    [data-theme="dark"] .modal-input { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
    .modal-input:focus { border-color: #3b82f6; }
    .modal-btns { display: flex; gap: 10px; margin-top: 16px; }
    .modal-btns .btn { flex: 1; padding: 12px; }
    .btn-cancel { background: var(--bg-card); border: 1px solid var(--border-card); color: var(--text-primary); }
    [data-theme="dark"] .btn-cancel { background: rgba(255,255,255,0.05); border: none; }
    
    .mode-tabs { display: flex; gap: 4px; background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 10px; padding: 4px; margin-bottom: 12px; }
    .mode-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 12px; background: transparent; border: none; border-radius: 8px; color: var(--text-muted); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
    .mode-tab svg { width: 16px; height: 16px; }
    .mode-tab.active { background: var(--accent); color: #fff; }
    .mode-tab:active { transform: scale(0.98); }
    
    .text-card { padding: 0; height: 160px; display: flex; flex-direction: column; }
    .text-card textarea { flex: 1; width: 100%; padding: 14px 16px; background: transparent; border: none; color: var(--text-primary); font-size: 14px; line-height: 1.5; resize: none; outline: none; font-family: inherit; }
    .text-card textarea::placeholder { color: var(--text-muted); }
    .text-card textarea { -webkit-user-select: text; user-select: text; }
    .text-card textarea:focus { background: rgba(59,130,246,0.03); }
    .text-card textarea:focus::placeholder { color: var(--accent-light); }
    .text-actions { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-top: 1px solid var(--border-card); }
    .paste-hint { display: flex; align-items: center; gap: 6px; color: var(--text-muted); font-size: 12px; }
    .paste-hint svg { width: 14px; height: 14px; }
    .paste-hint.hidden { display: none; }
    .text-count { font-size: 11px; color: var(--text-muted); }
    
    .text-list-card { min-height: auto; }
    .text-item { position: relative; padding: 14px 16px; padding-right: 56px; cursor: pointer; transition: background 0.15s; }
    .text-item:active { background: rgba(139,92,246,0.08); }
    .text-item.copied { background: rgba(34,197,94,0.08); }
    .text-item + .text-item { border-top: 1px solid var(--border-card); }
    .text-from { font-size: 11px; color: var(--text-muted); margin-bottom: 6px; display: flex; align-items: center; gap: 4px; }
    .text-from svg { width: 12px; height: 12px; }
    .text-preview { font-size: 14px; line-height: 1.6; color: var(--text-primary); word-break: break-all; white-space: pre-wrap; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .text-action-icon { position: absolute; top: 50%; right: 14px; transform: translateY(-50%); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: rgba(139,92,246,0.15); border-radius: 8px; color: #a78bfa; transition: all 0.15s; }
    .text-action-icon.success { background: rgba(34,197,94,0.15); color: #22c55e; }
    .text-action-icon svg { width: 16px; height: 16px; }
    
    .toast { position: fixed; top: max(20px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%) translateY(-100px); background: rgba(255,255,255,0.98); color: #333; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 500; z-index: 1000; opacity: 0; transition: all 0.3s cubic-bezier(0.4,0,0.2,1); pointer-events: none; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 8px; }
    .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
    .toast::before { content: ''; width: 18px; height: 18px; border-radius: 50%; background: #3b82f6; flex-shrink: 0; }
    .toast.success::before { background: #10b981; }
    .toast.error::before { background: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <svg viewBox="0 0 1024 1024" fill="#3b82f6"><path d="M841.8 456.4c2.4-12.7 3.6-25.7 3.6-38.7 0-117.5-95.6-213.2-213.1-213.2-65.3 0-125.4 29.9-165.2 78.6-26.6-13.6-56.3-20.9-86.9-20.9-92.2 0-169.4 65.6-187.3 152.7-76.7 33.1-129 109.8-129 195.8 0 117.5 95.6 213.1 213.2 213.1h490.6c105.4 0 191.2-85.8 191.2-191.2-0.1-79.1-48.5-147.2-117.1-176.2z m-74.3 311.5H276.9c-86.9 0-157.3-70.4-157.3-157.3 0-75.9 53.8-139.2 125.3-154 0-1.1-0.2-2.2-0.2-3.3 0-74.7 60.6-135.3 135.4-135.3 41.6 0 78.7 18.8 103.5 48.3 21.3-61.6 79.7-105.9 148.5-105.9 86.9 0 157.3 70.4 157.3 157.3 0 29.1-8 56.2-21.8 79.6 74.7 0.1 135.2 60.6 135.2 135.3 0.1 74.7-60.5 135.3-135.3 135.3z"/><path d="M767.7 531.3c-0.1 0-0.1 0 0 0-10.3 0-18.6 8.3-18.6 18.6s8.3 18.6 18.6 18.7c35.3 0 64 28.8 64 64.1s-28.7 64.1-64.1 64.1H276.9c-47.4 0-86-38.6-86-86 0-40.6 28.8-76 68.4-84.2 10.1-2.1 16.6-11.9 14.5-22-2.1-10.1-11.9-16.5-22-14.5-56.9 11.8-98.1 62.5-98.1 120.7 0 68 55.3 123.3 123.3 123.3h490.6c55.9 0 101.3-45.5 101.3-101.3 0-56-45.4-101.5-101.2-101.5zM527.3 401.1c9.7 3.3 20.3-1.8 23.7-11.5 12-34.7 44.6-57.9 81.2-57.9 47.4 0 86 38.6 86 86 0 15.1-4.1 30.2-11.9 43.4-5.2 8.9-2.3 20.3 6.6 25.5 3 1.7 6.2 2.6 9.4 2.6 6.4 0 12.6-3.3 16.1-9.2 11.2-19 17.1-40.6 17.1-62.3 0-68-55.3-123.3-123.3-123.3-52.4 0-99.2 33.4-116.4 83-3.3 9.7 1.8 20.3 11.5 23.7zM297.2 470.9h0.3c10.2 0 18.5-8.2 18.6-18.4 0.5-34.8 29.2-63.2 64.1-63.2 18.9 0 36.8 8.3 49 22.9 6.6 7.9 18.4 8.9 26.2 2.3 7.9-6.6 8.9-18.4 2.3-26.3-19.3-23-47.6-36.2-77.5-36.2-55.1 0-100.6 44.8-101.3 100-0.2 10.3 8 18.7 18.3 18.9z"/></svg>
        <h1>Airdrop</h1>
      </div>
      <div class="device-info">
        <div class="device-info-left">
          <span class="device-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg><span id="deviceName">-</span></span>
          <span class="status-badge">已连接</span>
        </div>
        <div class="device-info-right">
          <div class="theme-switcher">
            <button class="theme-btn" data-theme="system" onclick="setTheme('system')" title="跟随系统">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            </button>
            <button class="theme-btn" data-theme="light" onclick="setTheme('light')" title="浅色">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            </button>
            <button class="theme-btn" data-theme="dark" onclick="setTheme('dark')" title="深色">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div class="my-device">
      <div class="my-avatar">📱</div>
      <div class="my-info">
        <div class="my-name"><span id="myName">我的手机</span></div>
        <div class="my-model" id="myModel">检测中...</div>
      </div>
      <button class="edit-btn" onclick="showEditModal()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>
    
    <!-- 设备选择器 -->
    <div class="section">
      <div class="section-header">
        <span class="section-title">发送到</span>
        <span class="section-count" id="deviceCount">1 台设备</span>
      </div>
      <div class="device-list" id="deviceList"></div>
    </div>
    
    <div class="section">
      <div class="mode-tabs" id="modeTabs">
        <button class="mode-tab active" data-mode="file" onclick="switchMode('file')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M13 2v7h7"/></svg>
          文件
        </button>
        <button class="mode-tab" data-mode="text" onclick="switchMode('text')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          文本
        </button>
      </div>
      
      <div id="fileMode">
        <div class="card file-card">
          <div class="drop-zone" id="dropZone">
            <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg></div>
            <div class="drop-text">点击或拖放文件</div>
            <div class="drop-hint">支持多选和粘贴</div>
          </div>
          <div class="file-list-container" id="fileListContainer" style="display:none;">
            <div class="file-list-header">
              <span>已选择 <span id="fileCount">0</span> 个文件</span>
              <button class="btn-clear-files" onclick="clearFiles()">清空</button>
            </div>
            <div class="file-list" id="fileList"></div>
            <button class="btn-add-more" onclick="document.getElementById('fileInput').click()">+ 添加更多</button>
          </div>
          <input type="file" class="file-input" id="fileInput" multiple>
        </div>
        <button class="btn btn-primary" id="uploadBtn" disabled style="margin-top:12px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
          发送文件
        </button>
      </div>
      
      <div id="textMode" style="display:none;">
        <div class="card text-card">
          <textarea id="textInput" placeholder="长按此处粘贴文本，或直接输入..."></textarea>
          <div class="text-actions">
            <div class="paste-hint" id="pasteHint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              <span>长按输入框粘贴</span>
            </div>
            <span class="text-count"><span id="charCount">0</span> 字</span>
          </div>
        </div>
        <button class="btn btn-primary" id="sendTextBtn" disabled style="margin-top:12px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          发送文本
        </button>
      </div>
      
      <div id="status" class="status" style="display:none;"></div>
    </div>
    
    <div class="section download-section" id="downloadSection">
      <div class="section-header">
        <span class="section-title">传输记录</span>
        <span class="section-count" id="downloadCount"></span>
      </div>
      <div class="card download-card" id="downloadList"></div>
    </div>
    
    <div class="section text-section" id="textSection" style="display:none;">
      <div class="section-header">
        <span class="section-title">传输记录</span>
      </div>
      <div class="card text-list-card" id="textList"></div>
    </div>
  </div>
  
  <div class="modal" id="editModal">
    <div class="modal-content">
      <div class="modal-title">设置设备名称</div>
      <input type="text" class="modal-input" id="nameInput" placeholder="输入昵称" maxlength="20">
      <div class="modal-btns">
        <button class="btn btn-cancel" onclick="hideEditModal()">取消</button>
        <button class="btn btn-primary" onclick="saveName()">保存</button>
      </div>
    </div>
  </div>
  
  <div class="toast" id="toast"></div>
  
  <script>
    // 主题初始化
    const savedTheme = localStorage.getItem('airdrop_theme') || 'system';
    applyTheme(savedTheme);
    updateThemeButtons(savedTheme);
    
    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const current = localStorage.getItem('airdrop_theme') || 'system';
      if (current === 'system') applyTheme('system');
    });
    
    function setTheme(theme) {
      localStorage.setItem('airdrop_theme', theme);
      applyTheme(theme);
      updateThemeButtons(theme);
    }
    
    function applyTheme(theme) {
      if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
    }
    
    function updateThemeButtons(theme) {
      document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
      });
    }
    
    let clientId = null;
    let ws = null;
    let uploadWs = null;
    let selectedFiles = [];
    let myName = localStorage.getItem('airdrop_name') || '';
    let devices = []; // 可用设备列表
    let selectedDeviceId = 'host'; // 当前选中的目标设备
    
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const uploadBtn = document.getElementById('uploadBtn');
    const statusEl = document.getElementById('status');
    const deviceNameEl = document.getElementById('deviceName');
    const downloadSection = document.getElementById('downloadSection');
    const downloadList = document.getElementById('downloadList');
    const myNameEl = document.getElementById('myName');
    const myModelEl = document.getElementById('myModel');
    const downloadCountEl = document.getElementById('downloadCount');
    const editModal = document.getElementById('editModal');
    const nameInput = document.getElementById('nameInput');
    const textSection = document.getElementById('textSection');
    const textList = document.getElementById('textList');
    const deviceListEl = document.getElementById('deviceList');
    const deviceCountEl = document.getElementById('deviceCount');
    const textInput = document.getElementById('textInput');
    const sendTextBtn = document.getElementById('sendTextBtn');
    
    const charCountEl = document.getElementById('charCount');
    const fileModeEl = document.getElementById('fileMode');
    const textModeEl = document.getElementById('textMode');
    
    let currentMode = 'file';
    
    // Toast 提示
    const toastEl = document.getElementById('toast');
    let toastTimer = null;
    
    function showToast(msg, type = '') {
      if (toastTimer) clearTimeout(toastTimer);
      toastEl.textContent = msg;
      toastEl.className = 'toast show' + (type ? ' ' + type : '');
      toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 2500);
    }
    
    // 复制文本到剪贴板（用于接收其他手机发来的文本）
    function copyTextToClipboard(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(textarea);
    }
    
    function switchMode(mode) {
      currentMode = mode;
      document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
      });
      fileModeEl.style.display = mode === 'file' ? 'block' : 'none';
      textModeEl.style.display = mode === 'text' ? 'block' : 'none';
    }
    
    const pasteHint = document.getElementById('pasteHint');
    
    // 输入框获得焦点时隐藏提示
    textInput.onfocus = () => {
      pasteHint.classList.add('hidden');
    };
    
    // 输入框失去焦点且为空时显示提示
    textInput.onblur = () => {
      if (!textInput.value.trim()) {
        pasteHint.classList.remove('hidden');
      }
    };
    
    textInput.oninput = () => { 
      charCountEl.textContent = textInput.value.length;
      sendTextBtn.disabled = !textInput.value.trim();
      // 有内容时隐藏提示
      if (textInput.value.trim()) {
        pasteHint.classList.add('hidden');
      }
    };
    
    // 监听粘贴事件，显示成功提示
    textInput.onpaste = () => {
      setTimeout(() => {
        if (textInput.value.trim()) {
          showToast('已粘贴', 'success');
          charCountEl.textContent = textInput.value.length;
          sendTextBtn.disabled = false;
          pasteHint.classList.add('hidden');
        }
      }, 10);
    };
    sendTextBtn.onclick = () => {
      const text = textInput.value.trim();
      if (text && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'send-text', text, targetId: selectedDeviceId }));
        textInput.value = '';
        charCountEl.textContent = '0';
        sendTextBtn.disabled = true;
      }
    };
    
    // 更新设备列表 UI
    function updateDeviceList() {
      deviceCountEl.textContent = devices.length + ' 台设备';
      deviceListEl.innerHTML = devices.map(d => {
        const isSelected = d.id === selectedDeviceId;
        const avatarClass = d.type === 'pc' ? 'pc' : 'mobile';
        // 简化名称显示
        let shortName = d.name;
        if (shortName.length > 10) {
          shortName = shortName.slice(0, 10) + '...';
        }
        const icon = d.type === 'pc' 
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>';
        return '<div class="device-item' + (isSelected ? ' selected' : '') + '" data-id="' + d.id + '" onclick="selectDevice(\\'' + d.id + '\\')">' +
          '<div class="device-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></div>' +
          '<div class="device-avatar ' + avatarClass + '">' + icon + '</div>' +
          '<div class="device-item-info"><span class="device-item-name">' + shortName + '</span></div>' +
        '</div>';
      }).join('');
      updateHeaderDevice();
    }
    
    // 选择目标设备
    function selectDevice(deviceId) {
      selectedDeviceId = deviceId;
      document.querySelectorAll('.device-item').forEach(el => {
        el.classList.toggle('selected', el.dataset.id === deviceId);
      });
      updateHeaderDevice();
    }
    
    // 更新顶部显示的连接设备
    function updateHeaderDevice() {
      const device = devices.find(d => d.id === selectedDeviceId);
      if (device) {
        deviceNameEl.textContent = device.name;
        // 更新图标
        const badge = document.querySelector('.device-badge');
        if (badge) {
          const iconSvg = device.type === 'pc' 
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>';
          badge.innerHTML = iconSvg + '<span id="deviceName">' + device.name + '</span>';
        }
      }
    }
    
    // 检测设备型号
    function getDeviceModel() {
      const ua = navigator.userAgent;
      if (/iPhone/.test(ua)) {
        const match = ua.match(/iPhone\\s*(?:OS\\s*)?([\\d_]+)?/);
        return 'iPhone' + (match ? ' (iOS ' + (match[1] || '').replace(/_/g, '.').split('.').slice(0,2).join('.') + ')' : '');
      }
      if (/iPad/.test(ua)) return 'iPad';
      if (/Android/.test(ua)) {
        const model = ua.match(/;\\s*([^;)]+)\\s*Build/);
        const ver = ua.match(/Android\\s*([\\d.]+)/);
        if (model) return model[1].trim() + (ver ? ' (Android ' + ver[1] + ')' : '');
        return 'Android' + (ver ? ' ' + ver[1] : '');
      }
      if (/HarmonyOS/.test(ua)) return '华为 (HarmonyOS)';
      return navigator.platform || '未知设备';
    }
    
    // 初始化设备信息
    const deviceModel = getDeviceModel();
    myModelEl.textContent = deviceModel;
    if (!myName) {
      myName = deviceModel.split(' ')[0] || '我的手机';
    }
    myNameEl.textContent = myName;
    
    function showEditModal() {
      nameInput.value = myName;
      editModal.classList.add('show');
      setTimeout(() => nameInput.focus(), 100);
    }
    
    function hideEditModal() {
      editModal.classList.remove('show');
    }
    
    function saveName() {
      const name = nameInput.value.trim();
      if (name) {
        myName = name;
        myNameEl.textContent = myName;
        localStorage.setItem('airdrop_name', myName);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'set-name', name: myName }));
        }
      }
      hideEditModal();
    }
    
    nameInput.onkeydown = (e) => { if (e.key === 'Enter') saveName(); };
    editModal.onclick = (e) => { if (e.target === editModal) hideEditModal(); };
    
    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(protocol + '//' + location.host);
      
      ws.onopen = () => {
        // 连接后发送设备名称（直接使用完整型号信息）
        ws.send(JSON.stringify({ type: 'set-name', name: deviceModel }));
      };
      
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'connected') {
          clientId = msg.clientId;
          deviceNameEl.textContent = msg.deviceName;
          // 初始化设备列表（至少有当前电脑）
          if (devices.length === 0) {
            devices = [{ id: 'host', name: msg.deviceName, type: 'pc' }];
            updateDeviceList();
          }
        } else if (msg.type === 'devices-updated') {
          // 更新设备列表
          devices = msg.devices || [];
          // 如果当前选中的设备不在列表中，重置为 host
          if (!devices.find(d => d.id === selectedDeviceId)) {
            selectedDeviceId = 'host';
          }
          updateDeviceList();
        } else if (msg.type === 'files-updated') {
          updateDownloadList(msg.files, msg.texts);
        } else if (msg.type === 'text-from-mobile') {
          // 收到其他手机发来的文本
          showToast('收到来自 ' + msg.from + ' 的文本', 'success');
          // 可以显示在文本列表中或自动复制
          if (msg.text) {
            copyTextToClipboard(msg.text);
          }
        } else if (msg.type === 'text-received') {
          textInput.value = '';
          charCountEl.textContent = '0';
          sendTextBtn.disabled = true;
          const targetDevice = devices.find(d => d.id === selectedDeviceId);
          showToast('文本已发送到 ' + (targetDevice?.name || '设备'), 'success');
        }
      };
      
      ws.onclose = () => setTimeout(connect, 2000);
    }
    connect();
    
    function copyText(id, text, itemEl) {
      // 同步执行复制，确保在用户手势上下文中
      let success = false;
      
      // 方法1: 使用 textarea + execCommand (兼容性最好)
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      
      try {
        success = document.execCommand('copy');
      } catch (e) {
        success = false;
      }
      document.body.removeChild(textarea);
      
      // 方法2: 如果方法1失败，尝试 Clipboard API
      if (!success && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          showCopySuccess(id, itemEl);
        }).catch(() => {
          showToast('复制失败，请长按文本手动复制', 'error');
        });
        return;
      }
      
      if (success) {
        showCopySuccess(id, itemEl);
      } else {
        showToast('复制失败，请长按文本手动复制', 'error');
      }
    }
    
    function showCopySuccess(id, itemEl) {
      if (itemEl) {
        itemEl.classList.add('copied');
        const icon = itemEl.querySelector('.text-action-icon');
        if (icon) {
          icon.classList.add('success');
          icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
        }
        setTimeout(() => {
          itemEl.classList.remove('copied');
          if (icon) {
            icon.classList.remove('success');
            icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
          }
        }, 1500);
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'copy-text', id }));
      }
      showToast('已复制到剪贴板', 'success');
    }
    
    function updateDownloadList(files, texts) {
      if (files && files.length > 0) {
        downloadSection.classList.add('show');
        downloadCountEl.textContent = files.length + ' 个文件';
        downloadList.innerHTML = files.map(f => 
          '<div class="download-item"><div class="file-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M13 2v7h7"/></svg></div><div class="file-info"><div class="file-name">' + f.name + '</div><div class="file-size">' + formatSize(f.size) + '</div></div><a href="/download/' + clientId + '/' + f.id + '" class="btn btn-download"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>下载</a></div>'
        ).join('');
      } else {
        downloadSection.classList.remove('show');
      }
      
      // 更新文本列表
      if (texts && texts.length > 0) {
        textSection.style.display = 'block';
        const pcName = deviceNameEl.textContent || '电脑';
        // 存储文本数据
        window._sharedTexts = {};
        texts.forEach(t => { window._sharedTexts[t.id] = t.text; });
        textList.innerHTML = texts.map(t => 
          '<div class="text-item" data-id="' + t.id + '"><div class="text-from"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>' + pcName + '</div><div class="text-preview">' + t.text + '</div><span class="text-action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></span></div>'
        ).join('');
        // 绑定点击事件 - 点击整行复制
        textList.querySelectorAll('.text-item').forEach(item => {
          item.onclick = function() {
            const id = this.dataset.id;
            const text = window._sharedTexts[id];
            if (text) copyText(id, text, this);
          };
        });
      } else {
        textSection.style.display = 'none';
      }
    }
    
    function formatSize(b) { return b < 1024 ? b + ' B' : b < 1048576 ? (b/1024).toFixed(1) + ' KB' : b < 1073741824 ? (b/1048576).toFixed(1) + ' MB' : (b/1073741824).toFixed(2) + ' GB'; }
    
    dropZone.onclick = () => fileInput.click();
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('active'); };
    dropZone.ondragleave = () => dropZone.classList.remove('active');
    dropZone.ondrop = (e) => { e.preventDefault(); dropZone.classList.remove('active'); addFiles(e.dataTransfer.files); };
    fileInput.onchange = () => addFiles(fileInput.files);
    
    // 全局粘贴支持
    document.addEventListener('paste', (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const files = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        addFiles(files);
        switchMode('file');
      }
    });
    
    function addFiles(files) {
      for (const f of files) if (!selectedFiles.find(sf => sf.name === f.name && sf.size === f.size)) selectedFiles.push(f);
      renderFiles();
    }
    
    function removeFile(i) { selectedFiles.splice(i, 1); renderFiles(); }
    function clearFiles() { selectedFiles = []; renderFiles(); }
    
    const fileListContainer = document.getElementById('fileListContainer');
    const fileCountEl = document.getElementById('fileCount');
    
    function renderFiles() {
      if (selectedFiles.length > 0) {
        dropZone.style.display = 'none';
        fileListContainer.style.display = 'block';
        fileCountEl.textContent = selectedFiles.length;
        fileList.innerHTML = selectedFiles.map((f, i) => '<div class="file-item" id="file-' + i + '"><div class="file-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M13 2v7h7"/></svg></div><div class="file-info"><div class="file-name">' + f.name + '</div><div class="file-size">' + formatSize(f.size) + '</div><div class="progress-bar" style="display:none;"><div class="progress-fill" style="width:0%"></div></div></div><button class="file-remove" onclick="removeFile(' + i + ')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>').join('');
      } else {
        dropZone.style.display = 'flex';
        fileListContainer.style.display = 'none';
        fileList.innerHTML = '';
      }
      uploadBtn.disabled = selectedFiles.length === 0;
    }
    
    uploadBtn.onclick = async () => {
      if (!selectedFiles.length) return;
      uploadBtn.disabled = true;
      statusEl.style.display = 'block';
      statusEl.className = 'status info';
      statusEl.textContent = '连接中...';
      
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      uploadWs = new WebSocket(protocol + '//' + location.host);
      uploadWs.onopen = () => uploadFiles();
      uploadWs.onerror = () => { statusEl.className = 'status error'; statusEl.textContent = '连接失败'; uploadBtn.disabled = false; };
    };
    
    async function uploadFiles() {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const el = document.getElementById('file-' + i);
        const bar = el.querySelector('.progress-bar');
        const fill = el.querySelector('.progress-fill');
        const rm = el.querySelector('.file-remove');
        bar.style.display = 'block'; rm.style.display = 'none';
        statusEl.textContent = '上传: ' + file.name;
        await uploadFile(file, (p) => { fill.style.width = p + '%'; });
      }
      statusEl.className = 'status success';
      statusEl.textContent = '✓ 上传完成';
      selectedFiles = [];
      setTimeout(() => { renderFiles(); statusEl.style.display = 'none'; uploadBtn.disabled = false; }, 2000);
    }
    
    function uploadFile(file, onProgress) {
      return new Promise((resolve) => {
        const CHUNK = 64 * 1024;
        let offset = 0;
        // 发送文件开始消息，包含目标设备 ID
        uploadWs.send(JSON.stringify({ type: 'file-start', name: file.name, size: file.size, targetId: selectedDeviceId }));
        const onMsg = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'ready') sendChunk();
          else if (msg.type === 'complete') { uploadWs.removeEventListener('message', onMsg); resolve(); }
        };
        uploadWs.addEventListener('message', onMsg);
        function sendChunk() {
          if (offset >= file.size) { uploadWs.send(JSON.stringify({ type: 'file-end' })); return; }
          const chunk = file.slice(offset, offset + CHUNK);
          const reader = new FileReader();
          reader.onload = () => { uploadWs.send(reader.result); offset += chunk.size; onProgress(Math.round((offset / file.size) * 100)); sendChunk(); };
          reader.readAsArrayBuffer(chunk);
        }
      });
    }
  </script>
</body>
</html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }

  stop() {
    this.wss?.close();
    this.httpServer?.close();
    this.sharedFiles.clear();
    this.clients.clear();
  }
}
