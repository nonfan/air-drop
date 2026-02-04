/**
 * AccessControlService 单元测试
 */

import { AccessControlService, Permission } from '../services/security/AccessControlService';

describe('AccessControlService', () => {
  let accessControl: AccessControlService;

  beforeEach(() => {
    accessControl = new AccessControlService();
  });

  describe('权限授予', () => {
    it('应该授予单个权限', () => {
      accessControl.grantPermission('device-1', Permission.READ);
      
      expect(accessControl.hasPermission('device-1', Permission.READ)).toBe(true);
    });

    it('应该授予多个权限', () => {
      accessControl.grantPermissions('device-1', [Permission.READ, Permission.WRITE]);
      
      expect(accessControl.hasPermission('device-1', Permission.READ)).toBe(true);
      expect(accessControl.hasPermission('device-1', Permission.WRITE)).toBe(true);
    });

    it('应该授予默认权限', () => {
      accessControl.grantDefaultPermissions('device-1');
      
      expect(accessControl.hasPermission('device-1', Permission.READ)).toBe(true);
      expect(accessControl.hasPermission('device-1', Permission.WRITE)).toBe(true);
    });

    it('不应该重复添加相同的权限', () => {
      accessControl.grantPermission('device-1', Permission.READ);
      accessControl.grantPermission('device-1', Permission.READ);
      
      const perms = accessControl.getDevicePermissions('device-1');
      expect(perms?.permissions.filter(p => p === Permission.READ)).toHaveLength(1);
    });

    it('应该支持权限过期时间', () => {
      const expiresAt = Date.now() + 60000; // 1分钟后
      accessControl.grantPermission('device-1', Permission.READ, expiresAt);
      
      const perms = accessControl.getDevicePermissions('device-1');
      expect(perms?.expiresAt).toBe(expiresAt);
    });
  });

  describe('权限检查', () => {
    beforeEach(() => {
      accessControl.grantPermissions('device-1', [Permission.READ, Permission.WRITE]);
    });

    it('应该检查单个权限', () => {
      expect(accessControl.hasPermission('device-1', Permission.READ)).toBe(true);
      expect(accessControl.hasPermission('device-1', Permission.DELETE)).toBe(false);
    });

    it('应该检查多个权限', () => {
      expect(accessControl.hasPermissions('device-1', [Permission.READ, Permission.WRITE])).toBe(true);
      expect(accessControl.hasPermissions('device-1', [Permission.READ, Permission.DELETE])).toBe(false);
    });

    it('应该检查是否有任一权限', () => {
      expect(accessControl.hasAnyPermission('device-1', [Permission.READ, Permission.DELETE])).toBe(true);
      expect(accessControl.hasAnyPermission('device-1', [Permission.DELETE])).toBe(false);
    });

    it('不存在的设备应该没有权限', () => {
      expect(accessControl.hasPermission('non-existent', Permission.READ)).toBe(false);
    });

    it('过期的权限应该无效', () => {
      const expiresAt = Date.now() - 1000; // 已过期
      accessControl.grantPermission('device-2', Permission.READ, expiresAt);
      
      expect(accessControl.hasPermission('device-2', Permission.READ)).toBe(false);
    });
  });

  describe('权限撤销', () => {
    beforeEach(() => {
      accessControl.grantPermissions('device-1', [Permission.READ, Permission.WRITE, Permission.DELETE]);
    });

    it('应该撤销单个权限', () => {
      accessControl.revokePermission('device-1', Permission.READ);
      
      expect(accessControl.hasPermission('device-1', Permission.READ)).toBe(false);
      expect(accessControl.hasPermission('device-1', Permission.WRITE)).toBe(true);
    });

    it('应该撤销多个权限', () => {
      accessControl.revokePermissions('device-1', [Permission.READ, Permission.WRITE]);
      
      expect(accessControl.hasPermission('device-1', Permission.READ)).toBe(false);
      expect(accessControl.hasPermission('device-1', Permission.WRITE)).toBe(false);
      expect(accessControl.hasPermission('device-1', Permission.DELETE)).toBe(true);
    });

    it('应该撤销所有权限', () => {
      accessControl.revokePermission('device-1');
      
      expect(accessControl.hasPermission('device-1', Permission.READ)).toBe(false);
      expect(accessControl.hasPermission('device-1', Permission.WRITE)).toBe(false);
      expect(accessControl.hasPermission('device-1', Permission.DELETE)).toBe(false);
    });

    it('撤销最后一个权限应该删除设备记录', () => {
      accessControl.revokePermissions('device-1', [Permission.READ, Permission.WRITE, Permission.DELETE]);
      
      const perms = accessControl.getDevicePermissions('device-1');
      expect(perms).toBeNull();
    });
  });

  describe('权限查询', () => {
    beforeEach(() => {
      accessControl.grantPermissions('device-1', [Permission.READ, Permission.WRITE]);
      accessControl.grantPermission('device-2', Permission.READ);
    });

    it('应该获取设备权限', () => {
      const perms = accessControl.getDevicePermissions('device-1');
      
      expect(perms).toBeDefined();
      expect(perms?.deviceId).toBe('device-1');
      expect(perms?.permissions).toContain(Permission.READ);
      expect(perms?.permissions).toContain(Permission.WRITE);
    });

    it('应该获取所有设备权限', () => {
      const allPerms = accessControl.getAllDevicePermissions();
      
      expect(allPerms).toHaveLength(2);
    });

    it('不存在的设备应该返回 null', () => {
      const perms = accessControl.getDevicePermissions('non-existent');
      
      expect(perms).toBeNull();
    });
  });

  describe('权限过期管理', () => {
    it('应该设置权限过期时间', () => {
      accessControl.grantPermission('device-1', Permission.READ);
      const expiresAt = Date.now() + 60000;
      
      const success = accessControl.setPermissionExpiry('device-1', expiresAt);
      
      expect(success).toBe(true);
      expect(accessControl.getDevicePermissions('device-1')?.expiresAt).toBe(expiresAt);
    });

    it('应该移除权限过期时间', () => {
      const expiresAt = Date.now() + 60000;
      accessControl.grantPermission('device-1', Permission.READ, expiresAt);
      
      const success = accessControl.removePermissionExpiry('device-1');
      
      expect(success).toBe(true);
      expect(accessControl.getDevicePermissions('device-1')?.expiresAt).toBeUndefined();
    });

    it('应该检查权限是否即将过期', () => {
      const expiresAt = Date.now() + 30000; // 30秒后
      accessControl.grantPermission('device-1', Permission.READ, expiresAt);
      
      expect(accessControl.isPermissionExpiringSoon('device-1')).toBe(true);
    });

    it('应该获取权限剩余时间', () => {
      const expiresAt = Date.now() + 60000; // 1分钟后
      accessControl.grantPermission('device-1', Permission.READ, expiresAt);
      
      const remaining = accessControl.getPermissionTimeRemaining('device-1');
      
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(60000);
    });

    it('没有过期时间应该返回 null', () => {
      accessControl.grantPermission('device-1', Permission.READ);
      
      const remaining = accessControl.getPermissionTimeRemaining('device-1');
      
      expect(remaining).toBeNull();
    });
  });

  describe('清理和统计', () => {
    it('应该清理过期的权限', () => {
      const expiresAt = Date.now() - 1000; // 已过期
      accessControl.grantPermission('device-1', Permission.READ, expiresAt);
      accessControl.grantPermission('device-2', Permission.READ);
      
      accessControl.cleanupExpiredPermissions();
      
      expect(accessControl.getDevicePermissions('device-1')).toBeNull();
      expect(accessControl.getDevicePermissions('device-2')).toBeDefined();
    });

    it('应该获取权限统计', () => {
      accessControl.grantPermission('device-1', Permission.READ);
      accessControl.grantPermissions('device-2', [Permission.READ, Permission.WRITE]);
      accessControl.grantPermissions('device-3', [Permission.READ, Permission.WRITE, Permission.DELETE]);
      
      const stats = accessControl.getPermissionStats();
      
      expect(stats.totalDevices).toBe(3);
      expect(stats.devicesWithRead).toBe(3);
      expect(stats.devicesWithWrite).toBe(2);
      expect(stats.devicesWithDelete).toBe(1);
    });

    it('应该清除所有权限', () => {
      accessControl.grantPermission('device-1', Permission.READ);
      accessControl.grantPermission('device-2', Permission.WRITE);
      
      accessControl.clearAllPermissions();
      
      expect(accessControl.getAllDevicePermissions()).toHaveLength(0);
    });
  });

  describe('导入导出', () => {
    it('应该导出权限配置', () => {
      accessControl.grantPermissions('device-1', [Permission.READ, Permission.WRITE]);
      accessControl.grantPermission('device-2', Permission.READ);
      
      const exported = accessControl.exportPermissions();
      
      expect(Object.keys(exported)).toHaveLength(2);
      expect(exported['device-1']).toBeDefined();
      expect(exported['device-2']).toBeDefined();
    });

    it('应该导入权限配置', () => {
      const permissions = {
        'device-1': {
          deviceId: 'device-1',
          permissions: [Permission.READ, Permission.WRITE],
          grantedAt: Date.now()
        },
        'device-2': {
          deviceId: 'device-2',
          permissions: [Permission.READ],
          grantedAt: Date.now()
        }
      };
      
      accessControl.importPermissions(permissions);
      
      expect(accessControl.hasPermission('device-1', Permission.READ)).toBe(true);
      expect(accessControl.hasPermission('device-2', Permission.READ)).toBe(true);
    });

    it('导入应该清除现有权限', () => {
      accessControl.grantPermission('device-1', Permission.READ);
      
      const permissions = {
        'device-2': {
          deviceId: 'device-2',
          permissions: [Permission.WRITE],
          grantedAt: Date.now()
        }
      };
      
      accessControl.importPermissions(permissions);
      
      expect(accessControl.hasPermission('device-1', Permission.READ)).toBe(false);
      expect(accessControl.hasPermission('device-2', Permission.WRITE)).toBe(true);
    });
  });
});
