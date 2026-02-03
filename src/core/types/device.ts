export interface Device {
  id: string;
  name: string;
  ip: string;
  port?: number;
  type: 'pc' | 'mobile';
  model?: string;
  lastSeen?: number;
}

export interface DeviceInfo {
  deviceName: string;
  deviceModel?: string;
  platform: 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'web';
}
