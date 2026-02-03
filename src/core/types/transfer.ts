export interface TransferProgress {
  transferId: string;
  fileName: string;
  percent: number;
  speed: number;
  remainingTime?: number;
  sentSize: number;
  totalSize: number;
}

export interface TransferResult {
  success: boolean;
  transferId: string;
  fileName: string;
  error?: string;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}
