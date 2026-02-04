/**
 * 视频缩略图生成工具
 * 针对 iOS Safari 优化，实现"秒开"效果
 */

/**
 * 生成视频缩略图
 * @param file 用户选择的视频文件
 * @param maxSize 缩略图最大尺寸（宽或高），默认 200px
 * @returns Promise<string> 返回 Base64 缩略图
 */
export async function generateVideoThumbnail(
  file: File,
  maxSize: number = 200
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const url = URL.createObjectURL(file);

    // 关键属性：只加载元数据，且允许 iOS 内联播放（不弹窗）
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous'; // 避免跨域问题
    video.src = url;

    // 设置超时，避免大文件卡死
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('视频缩略图生成超时'));
    }, 10000); // 10秒超时

    // iOS 必须触发 load() 并在元数据加载后跳转到第一帧
    video.onloadedmetadata = () => {
      console.log('[VideoThumbnail] Metadata loaded:', {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight
      });

      // 这里的 0.001 是强制浏览器渲染第一帧的关键
      // iOS Safari 默认不会渲染第一帧（会显示黑屏）
      video.currentTime = 0.001;
    };

    video.onseeked = () => {
      try {
        console.log('[VideoThumbnail] Seeked to first frame');

        // 计算缩略图尺寸（保持宽高比）
        let width = video.videoWidth;
        let height = video.videoHeight;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        // 设置 canvas 尺寸
        canvas.width = width;
        canvas.height = height;

        // 绘制视频帧到 canvas
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('无法获取 Canvas 上下文');
        }

        ctx.drawImage(video, 0, 0, width, height);

        // 转换为 Base64（JPEG 格式，质量 0.7）
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);

        console.log('[VideoThumbnail] Thumbnail generated:', {
          size: thumbnail.length,
          dimensions: `${width}x${height}`
        });

        // 清理资源
        clearTimeout(timeout);
        cleanup();
        resolve(thumbnail);
      } catch (error) {
        clearTimeout(timeout);
        cleanup();
        reject(error);
      }
    };

    video.onerror = (e) => {
      console.error('[VideoThumbnail] Video error:', e);
      clearTimeout(timeout);
      cleanup();
      reject(new Error('视频处理失败'));
    };

    // 清理函数
    function cleanup() {
      URL.revokeObjectURL(url);
      video.src = '';
      video.load(); // 释放视频资源
    }
  });
}

/**
 * 检查文件是否为视频
 * @param file 文件对象
 * @returns boolean
 */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

/**
 * 检查文件是否为图片
 * @param file 文件对象
 * @returns boolean
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * 生成图片缩略图
 * @param file 图片文件
 * @param maxSize 缩略图最大尺寸
 * @returns Promise<string> 返回 Base64 缩略图
 */
export async function generateImageThumbnail(
  file: File,
  maxSize: number = 200
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        // 计算缩略图尺寸（保持宽高比）
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('无法获取 Canvas 上下文');
        }

        ctx.drawImage(img, 0, 0, width, height);
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);

        URL.revokeObjectURL(url);
        resolve(thumbnail);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片处理失败'));
    };

    img.src = url;
  });
}

/**
 * 智能生成文件缩略图
 * 根据文件类型自动选择合适的生成方法
 * @param file 文件对象
 * @param maxSize 缩略图最大尺寸
 * @returns Promise<string | null> 返回 Base64 缩略图，如果不支持则返回 null
 */
export async function generateFileThumbnail(
  file: File,
  maxSize: number = 200
): Promise<string | null> {
  try {
    // 超大文件（> 500MB）降级处理，返回 null 使用默认图标
    if (file.size > 500 * 1024 * 1024) {
      console.log('[FileThumbnail] File too large, using default icon:', file.size);
      return null;
    }

    if (isVideoFile(file)) {
      return await generateVideoThumbnail(file, maxSize);
    } else if (isImageFile(file)) {
      return await generateImageThumbnail(file, maxSize);
    }

    // 其他文件类型不生成缩略图
    return null;
  } catch (error) {
    console.error('[FileThumbnail] Failed to generate thumbnail:', error);
    return null;
  }
}
