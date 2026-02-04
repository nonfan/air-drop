/**
 * 访问控制服务
 * 管理设备权限和访问控制
 */

export enum Permission {
  READ = 'read',       // 读取文件
  WRITE = 'write',     // 发送文件
  DELETE = 'delete'    // 删除历史
}

export interface DevicePermissions {
  deviceId: string;
  permissions: Permission[];
  expiresAt?: number;  // 可选的过期时间
  grantedAt: number;   // 授予时间
}

export class AccessControlService {
  private permissions: Map<string, DevicePermissions> = new Map();
  private readonly DEFAULT_PERMISSIONS: Permission[] = [Permission.READ, Permission.WRITE];

  /**
   * 授予权限
   */
  grantPermission(
    deviceId: string,
    permission: Permission,
    expiresAt?: number
  ): void {
    const existing = this.permissions.get(deviceId);
    
    if (existing) {
      // 添加新权限（如果不存在）
      if (!existing.permissions.includes(permission)) {
        existing.permissions.push(permission);
      }
      // 更新过期时间
      if (expiresAt) {
        existing.expiresAt = expiresAt;
      }
    } else {
      // 创建新的权限记录
      this.permissions.set(deviceId, {
        deviceId,
        permissions: [permission],
        expiresAt,
        grantedAt: Date.now()
      });
    }
  }

  /**
   * 授予多个权限
   */
  grantPermissions(
    deviceId: string,
    permissions: Permission[],
    expiresAt?: number
  ): void {
    const existing = this.permissions.get(deviceId);
    
    if (existing) {
      // 合并权限
      for (const permission of permissions) {
        if (!existing.permissions.includes(permission)) {
          existing.permissions.push(permission);
        }
      }
      // 更新过期时间
      if (expiresAt) {
        existing.expiresAt = expiresAt;
      }
    } else {
      // 创建新的权限记录
      this.permissions.set(deviceId, {
        deviceId,
        permissions: [...permissions],
        expiresAt,
        grantedAt: Date.now()
      });
    }
  }

  /**
   * 授予默认权限
   */
  grantDefaultPermissions(deviceId: string, expiresAt?: number): void {
    this.grantPermissions(deviceId, this.DEFAULT_PERMISSIONS, expiresAt);
  }

  /**
   * 检查权限
   */
  hasPermission(deviceId: string, permission: Permission): boolean {
    const perms = this.permissions.get(deviceId);
    
    if (!perms) return false;
    
    // 检查是否过期
    if (perms.expiresAt && Date.now() > perms.expiresAt) {
      this.permissions.delete(deviceId);
      return false;
    }
    
    return perms.permissions.includes(permission);
  }

  /**
   * 检查多个权限
   */
  hasPermissions(deviceId: string, permissions: Permission[]): boolean {
    return permissions.every(permission => this.hasPermission(deviceId, permission));
  }

  /**
   * 检查是否有任一权限
   */
  hasAnyPermission(deviceId: string, permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(deviceId, permission));
  }

  /**
   * 撤销权限
   */
  revokePermission(deviceId: string, permission?: Permission): void {
    if (!permission) {
      // 撤销所有权限
      this.permissions.delete(deviceId);
    } else {
      const perms = this.permissions.get(deviceId);
      if (perms) {
        perms.permissions = perms.permissions.filter(p => p !== permission);
        // 如果没有权限了，删除记录
        if (perms.permissions.length === 0) {
          this.permissions.delete(deviceId);
        }
      }
    }
  }

  /**
   * 撤销多个权限
   */
  revokePermissions(deviceId: string, permissions: Permission[]): void {
    const perms = this.permissions.get(deviceId);
    if (perms) {
      perms.permissions = perms.permissions.filter(p => !permissions.includes(p));
      // 如果没有权限了，删除记录
      if (perms.permissions.length === 0) {
        this.permissions.delete(deviceId);
      }
    }
  }

  /**
   * 获取设备权限
   */
  getDevicePermissions(deviceId: string): DevicePermissions | null {
    const perms = this.permissions.get(deviceId);
    
    if (!perms) return null;
    
    // 检查是否过期
    if (perms.expiresAt && Date.now() > perms.expiresAt) {
      this.permissions.delete(deviceId);
      return null;
    }
    
    return perms;
  }

  /**
   * 获取所有设备权限
   */
  getAllDevicePermissions(): DevicePermissions[] {
    this.cleanupExpiredPermissions();
    return Array.from(this.permissions.values());
  }

  /**
   * 设置权限过期时间
   */
  setPermissionExpiry(deviceId: string, expiresAt: number): boolean {
    const perms = this.permissions.get(deviceId);
    if (perms) {
      perms.expiresAt = expiresAt;
      return true;
    }
    return false;
  }

  /**
   * 移除权限过期时间
   */
  removePermissionExpiry(deviceId: string): boolean {
    const perms = this.permissions.get(deviceId);
    if (perms) {
      delete perms.expiresAt;
      return true;
    }
    return false;
  }

  /**
   * 清理过期的权限
   */
  cleanupExpiredPermissions(): void {
    const now = Date.now();
    for (const [deviceId, perms] of this.permissions.entries()) {
      if (perms.expiresAt && now > perms.expiresAt) {
        this.permissions.delete(deviceId);
      }
    }
  }

  /**
   * 检查权限是否即将过期
   */
  isPermissionExpiringSoon(deviceId: string, thresholdMs: number = 60000): boolean {
    const perms = this.permissions.get(deviceId);
    if (!perms || !perms.expiresAt) return false;
    
    const timeRemaining = perms.expiresAt - Date.now();
    return timeRemaining > 0 && timeRemaining <= thresholdMs;
  }

  /**
   * 获取权限剩余时间（毫秒）
   */
  getPermissionTimeRemaining(deviceId: string): number | null {
    const perms = this.permissions.get(deviceId);
    if (!perms || !perms.expiresAt) return null;
    
    return Math.max(0, perms.expiresAt - Date.now());
  }

  /**
   * 清除所有权限
   */
  clearAllPermissions(): void {
    this.permissions.clear();
  }

  /**
   * 获取权限统计
   */
  getPermissionStats(): {
    totalDevices: number;
    devicesWithRead: number;
    devicesWithWrite: number;
    devicesWithDelete: number;
    expiredPermissions: number;
  } {
    this.cleanupExpiredPermissions();
    
    let devicesWithRead = 0;
    let devicesWithWrite = 0;
    let devicesWithDelete = 0;
    
    for (const perms of this.permissions.values()) {
      if (perms.permissions.includes(Permission.READ)) devicesWithRead++;
      if (perms.permissions.includes(Permission.WRITE)) devicesWithWrite++;
      if (perms.permissions.includes(Permission.DELETE)) devicesWithDelete++;
    }
    
    return {
      totalDevices: this.permissions.size,
      devicesWithRead,
      devicesWithWrite,
      devicesWithDelete,
      expiredPermissions: 0 // 已清理
    };
  }

  /**
   * 导出权限配置
   */
  exportPermissions(): Record<string, DevicePermissions> {
    const exported: Record<string, DevicePermissions> = {};
    for (const [deviceId, perms] of this.permissions.entries()) {
      exported[deviceId] = { ...perms };
    }
    return exported;
  }

  /**
   * 导入权限配置
   */
  importPermissions(permissions: Record<string, DevicePermissions>): void {
    this.permissions.clear();
    for (const [deviceId, perms] of Object.entries(permissions)) {
      this.permissions.set(deviceId, { ...perms });
    }
    this.cleanupExpiredPermissions();
  }
}
