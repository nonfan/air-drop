/**
 * 服务器选择组件
 * 显示通过 UDP 发现的服务器列表，允许用户选择连接
 */
import { DiscoveredServer } from '../utils/udpDiscovery';

interface ServerSelectorProps {
  servers: DiscoveredServer[];
  isDiscovering: boolean;
  onSelectServer: (server: DiscoveredServer) => void;
  onRefresh?: () => void;
}

export function ServerSelector({ servers, isDiscovering, onSelectServer, onRefresh }: ServerSelectorProps) {
  if (servers.length === 0 && !isDiscovering) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            选择服务器
          </h2>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isDiscovering}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="刷新"
            >
              <svg
                className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${isDiscovering ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
        </div>

        {isDiscovering && servers.length === 0 ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">正在搜索局域网内的服务器...</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              请确保设备在同一 WiFi 网络
            </p>
          </div>
        ) : servers.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-gray-600 dark:text-gray-400 mb-2">未发现服务器</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              请确保桌面端应用已启动
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {servers.map((server) => (
              <button
                key={server.id}
                onClick={() => onSelectServer(server)}
                className="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {server.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {server.ip}:{server.port}
                    </div>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}

        {isDiscovering && servers.length > 0 && (
          <div className="flex items-center justify-center mt-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
            继续搜索中...
          </div>
        )}
      </div>
    </div>
  );
}
