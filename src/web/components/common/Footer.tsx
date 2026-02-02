interface FooterProps {
  deviceName?: string;
  version?: string;
  variant?: 'simple' | 'detailed';
}

/**
 * 页面底部组件
 * 显示应用名称和版本信息
 * 
 * @param deviceName - 设备名称（桌面端使用）
 * @param version - 版本号
 * @param variant - 显示模式：simple（简单）或 detailed（详细）
 */
export function Footer({ deviceName, version = '1.0.0', variant = 'simple' }: FooterProps) {
  if (variant === 'detailed') {
    // 桌面端样式：显示设备名和版本号
    return (
      <div className="flex-shrink-0 px-6 py-3 border-t border-border bg-secondary/50">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{deviceName || 'Airdrop'}</span>
          <span>v{version}</span>
        </div>
      </div>
    );
  }

  // 网页端样式：居中显示应用名和版本
  return (
    <div className="px-4 py-6 text-center">
      <div className="text-base text-muted mb-1">Airdrop Web</div>
      <div className="text-sm text-muted">版本 {version}</div>
    </div>
  );
}
