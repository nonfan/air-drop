import { ExpressPeerServer } from 'peer';
import express from 'express';
import { APP_CONFIG } from '../config';

/**
 * 启动 PeerJS 信令服务器
 * 用于 P2P 连接的建立和协调
 */
export function startPeerServer() {
  const app = express();
  
  const server = app.listen(APP_CONFIG.PORTS.PEER_SERVER, '0.0.0.0', () => {
    console.log(`[PeerServer] Started on port ${APP_CONFIG.PORTS.PEER_SERVER}`);
  });

  const peerServer = ExpressPeerServer(server, {
    path: '/peerjs',
    allow_discovery: true,
    
    // 配置 ICE 服务器（用于 NAT 穿透）
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    }
  });

  app.use('/peerjs', peerServer);

  // 监听连接事件
  peerServer.on('connection', (client) => {
    console.log('[PeerServer] Client connected:', client.getId());
  });

  peerServer.on('disconnect', (client) => {
    console.log('[PeerServer] Client disconnected:', client.getId());
  });

  return { server, peerServer };
}
