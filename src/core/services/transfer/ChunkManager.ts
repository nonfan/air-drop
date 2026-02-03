/**
 * 分片管理器 - 处理文件分片
 */
export const CHUNK_SIZE = 1024 * 1024; // 1MB

export interface Chunk {
  index: number;
  start: number;
  end: number;
  data: Blob;
  uploaded: boolean;
}

export class ChunkManager {
  private chunks: Chunk[] = [];
  private file: File;

  constructor(file: File) {
    this.file = file;
    this.initializeChunks();
  }

  private initializeChunks(): void {
    const totalChunks = Math.ceil(this.file.size / CHUNK_SIZE);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, this.file.size);
      
      this.chunks.push({
        index: i,
        start,
        end,
        data: this.file.slice(start, end),
        uploaded: false
      });
    }
  }

  getChunk(index: number): Chunk | null {
    return this.chunks[index] || null;
  }

  getTotalChunks(): number {
    return this.chunks.length;
  }

  getUploadedChunks(): number {
    return this.chunks.filter(c => c.uploaded).length;
  }

  getRemainingChunks(): Chunk[] {
    return this.chunks.filter(c => !c.uploaded);
  }

  markChunkUploaded(index: number): void {
    const chunk = this.chunks[index];
    if (chunk) {
      chunk.uploaded = true;
    }
  }

  getProgress(): number {
    return (this.getUploadedChunks() / this.getTotalChunks()) * 100;
  }

  isComplete(): boolean {
    return this.getUploadedChunks() === this.getTotalChunks();
  }

  getFileName(): string {
    return this.file.name;
  }

  getFileSize(): number {
    return this.file.size;
  }
}
