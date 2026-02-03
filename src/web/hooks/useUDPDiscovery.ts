/**
 * UDP 发现 Hook
 * 用于手机端主动探测局域网内的服务器
 */
import { useEffect, useState, useCallback } from 'react';
import { UDPDiscovery, DiscoveredServer } from '../utils/udpDiscovery';

export function useUDPDiscovery(enabled: boolean = true) {
  const [servers, setServers] = useState<DiscoveredServer[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discovery] = useState(() => new UDPDiscovery());

  useEffect(() => {
    if (!enabled) {
      setIsDiscovering(false);
      return;
    }

    console.log('[useUDPDiscovery] 启动 UDP 发现');
    setIsDiscovering(true);

    discovery.start({
      onServerFound: (server) => {
        console.log('[useUDPDiscovery] 发现服务器:', server);
        setServers(prev => {
          const exists = prev.find(s => s.id === server.id);
          if (exists) {
            return prev.map(s => s.id === server.id ? server : s);
          }
          return [...prev, server];
        });
        
        // 找到服务器后，保持扫描状态但不再显示加载动画
        setTimeout(() => setIsDiscovering(false), 1000);
      },
      onServerLost: (serverId) => {
        console.log('[useUDPDiscovery] 服务器离线:', serverId);
        setServers(prev => prev.filter(s => s.id !== serverId));
      }
    });

    return () => {
      console.log('[useUDPDiscovery] 停止 UDP 发现');
      discovery.stop();
      setIsDiscovering(false);
    };
  }, [enabled, discovery]);

  const manualDiscover = useCallback(async () => {
    console.log('[useUDPDiscovery] 手动触发扫描');
    setIsDiscovering(true);
    try {
      const foundServers = await discovery.discover();
      setServers(foundServers);
    } finally {
      // 延迟关闭加载状态，让用户看到反馈
      setTimeout(() => setIsDiscovering(false), 1000);
    }
  }, [discovery]);

  return {
    servers,
    isDiscovering,
    manualDiscover
  };
}
