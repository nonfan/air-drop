/**
 * 权限管理对话框组件
 */

import React, { useState } from 'react';

export enum Permission {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete'
}

interface DevicePermissions {
  deviceId: string;
  permissions: Permission[];
  expiresAt?: number;
  grantedAt: number;
}

interface PermissionsDialogProps {
  isOpen: boolean;
  deviceName: string;
  deviceId: string;
  permissions: DevicePermissions | null;
  onSave?: (permissions: Permission[], expiresAt?: number) => void;
  onClose?: () => void;
}

export const PermissionsDialog: React.FC<PermissionsDialogProps> = ({
  isOpen,
  deviceName,
  permissions,
  onSave,
  onClose
}) => {
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(
    permissions?.permissions || [Permission.READ, Permission.WRITE]
  );
  const [hasExpiry, setHasExpiry] = useState(!!permissions?.expiresAt);
  const [expiryHours, setExpiryHours] = useState(24);

  const permissionInfo = {
    [Permission.READ]: {
      label: '接收文件',
      description: '允许此设备向你发送文件',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
        </svg>
      )
    },
    [Permission.WRITE]: {
      label: '发送文件',
      description: '允许向此设备发送文件',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      )
    },
    [Permission.DELETE]: {
      label: '删除历史',
      description: '允许删除传输历史记录',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      )
    }
  };

  const togglePermission = (permission: Permission) => {
    setSelectedPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const handleSave = () => {
    const expiresAt = hasExpiry
      ? Date.now() + expiryHours * 60 * 60 * 1000
      : undefined;

    onSave?.(selectedPermissions, expiresAt);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              管理权限
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {deviceName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 权限列表 */}
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            选择权限
          </h3>

          {Object.entries(permissionInfo).map(([permission, info]) => (
            <div
              key={permission}
              onClick={() => togglePermission(permission as Permission)}
              className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedPermissions.includes(permission as Permission)
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
            >
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${selectedPermissions.includes(permission as Permission)
                ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                {info.icon}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                  {info.label}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {info.description}
                </p>
              </div>

              <div className="flex-shrink-0">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedPermissions.includes(permission as Permission)
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-gray-300 dark:border-gray-600'
                  }`}>
                  {selectedPermissions.includes(permission as Permission) && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 过期设置 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              权限过期
            </h3>
            <button
              onClick={() => setHasExpiry(!hasExpiry)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${hasExpiry ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${hasExpiry ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>

          {hasExpiry && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                权限有效期（小时）
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="168"
                  value={expiryHours}
                  onChange={(e) => setExpiryHours(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-semibold text-gray-900 dark:text-white w-16 text-right">
                  {expiryHours} 小时
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                权限将在 {expiryHours} 小时后自动过期
              </p>
            </div>
          )}
        </div>

        {/* 当前权限信息 */}
        {permissions && (
          <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-semibold mb-1">当前权限</p>
                <p>授予时间：{new Date(permissions.grantedAt).toLocaleString('zh-CN')}</p>
                {permissions.expiresAt && (
                  <p>过期时间：{new Date(permissions.expiresAt).toLocaleString('zh-CN')}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 按钮 */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={selectedPermissions.length === 0}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};
