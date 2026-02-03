/**
 * HTTP 客户端 - 用于文件传输
 */
export class HttpClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  /**
   * 上传文件分片
   */
  async uploadChunk(
    file: Blob,
    options: {
      transferId: string;
      chunkIndex: number;
      totalChunks: number;
      fileName: string;
      targetId: string;
      onProgress?: (loaded: number, total: number) => void;
    }
  ): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('transferId', options.transferId);
    formData.append('chunkIndex', options.chunkIndex.toString());
    formData.append('totalChunks', options.totalChunks.toString());
    formData.append('fileName', options.fileName);
    formData.append('targetId', options.targetId);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && options.onProgress) {
          options.onProgress(e.loaded, e.total);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload error'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timeout'));
      });

      xhr.timeout = 300000; // 5 minutes
      xhr.open('POST', `${this.baseURL}/api/upload/chunk`);
      xhr.send(formData);
    });
  }

  /**
   * 下载文件（支持 Range 请求）
   */
  async downloadFile(
    fileId: string,
    options?: {
      onProgress?: (loaded: number, total: number) => void;
      signal?: AbortSignal;
    }
  ): Promise<Blob> {
    const response = await fetch(`${this.baseURL}/api/download/${fileId}`, {
      signal: options?.signal
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const contentLength = parseInt(response.headers.get('Content-Length') || '0');
    const reader = response.body?.getReader();
    
    if (!reader) {
      throw new Error('No response body');
    }

    const chunks: Uint8Array[] = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      receivedLength += value.length;

      if (options?.onProgress && contentLength > 0) {
        options.onProgress(receivedLength, contentLength);
      }
    }

    return new Blob(chunks);
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(fileId: string): Promise<{
    name: string;
    size: number;
    type: string;
  }> {
    const response = await fetch(`${this.baseURL}/api/file/${fileId}/info`);
    
    if (!response.ok) {
      throw new Error(`Failed to get file info: ${response.status}`);
    }

    return response.json();
  }
}
