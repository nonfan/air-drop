import * as fs from 'fs';
import * as path from 'path';

/**
 * 文件工具类
 */
export class FileUtils {
  /**
   * 获取唯一的文件路径（避免覆盖）
   */
  static getUniqueFilePath(directory: string, fileName: string): string {
    let filePath = path.join(directory, fileName);
    let counter = 1;
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);

    while (fs.existsSync(filePath)) {
      filePath = path.join(directory, `${base} (${counter})${ext}`);
      counter++;
    }
    
    return filePath;
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * 验证文件是否存在
   */
  static exists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  /**
   * 安全地获取文件大小
   */
  static getFileSize(filePath: string): number {
    try {
      return fs.statSync(filePath).size;
    } catch {
      return 0;
    }
  }

  /**
   * 确保目录存在
   */
  static ensureDirectory(directory: string): void {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
  }

  /**
   * 安全地删除文件
   */
  static safeDelete(filePath: string): boolean {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete file:', error);
      return false;
    }
  }

  /**
   * 获取文件扩展名（小写）
   */
  static getExtension(fileName: string): string {
    return path.extname(fileName).toLowerCase();
  }

  /**
   * 检查是否为图片文件
   */
  static isImage(fileName: string): boolean {
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
    return imageExts.includes(this.getExtension(fileName));
  }

  /**
   * 检查是否为视频文件
   */
  static isVideo(fileName: string): boolean {
    const videoExts = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm'];
    return videoExts.includes(this.getExtension(fileName));
  }

  /**
   * 检查是否为音频文件
   */
  static isAudio(fileName: string): boolean {
    const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];
    return audioExts.includes(this.getExtension(fileName));
  }

  /**
   * 根据文件大小动态计算分块大小
   */
  static getOptimalChunkSize(fileSize: number): number {
    if (fileSize > 100 * 1024 * 1024) { // > 100MB
      return 256 * 1024; // 256KB
    } else if (fileSize > 10 * 1024 * 1024) { // > 10MB
      return 64 * 1024; // 64KB
    } else {
      return 16 * 1024; // 16KB
    }
  }
}
