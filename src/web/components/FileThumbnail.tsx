/**
 * 文件缩略图组件
 * 支持视频和图片的缩略图显示
 */

interface FileThumbnailProps {
  fileName: string;
  fileType: string;
  thumbnail?: string;
  size?: 'small' | 'medium' | 'large';
}

export function FileThumbnail({ fileName, fileType, thumbnail, size = 'medium' }: FileThumbnailProps) {
  const sizeClasses = {
    small: 'w-12 h-12',
    medium: 'w-16 h-16',
    large: 'w-24 h-24'
  };

  const iconSizeClasses = {
    small: 'w-6 h-6',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  // 如果有缩略图，显示缩略图
  if (thumbnail) {
    return (
      <div className={`${sizeClasses[size]} rounded-lg overflow-hidden bg-secondary flex-shrink-0 relative`}>
        <img
          src={thumbnail}
          alt={fileName}
          className="w-full h-full object-cover"
        />
        {/* 视频标识 */}
        {fileType.startsWith('video/') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}
      </div>
    );
  }

  // 根据文件类型显示不同的图标
  const getFileIcon = () => {
    if (fileType.startsWith('video/')) {
      return (
        <svg className={`${iconSizeClasses[size]} text-blue-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
          <polygon points="10 8 16 12 10 16 10 8" />
        </svg>
      );
    }

    if (fileType.startsWith('image/')) {
      return (
        <svg className={`${iconSizeClasses[size]} text-green-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    }

    if (fileType.startsWith('audio/')) {
      return (
        <svg className={`${iconSizeClasses[size]} text-purple-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      );
    }

    // 默认文件图标
    return (
      <svg className={`${iconSizeClasses[size]} text-gray-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <polyline points="13 2 13 9 20 9" />
      </svg>
    );
  };

  return (
    <div className={`${sizeClasses[size]} rounded-lg bg-secondary flex items-center justify-center flex-shrink-0`}>
      {getFileIcon()}
    </div>
  );
}
