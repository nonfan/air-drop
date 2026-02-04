/**
 * 安全设置组件
 */

import React, { useState } from 'react';

interface SecuritySettingsProps {
  requirePairing?: boolean;
  encryptTransfers?: boolean;
  verifyIntegrity?: boolean;
  onRequirePairingChange?: (enabled: boolean) => void;
  onEncryptTransfersChange?: (enabled: boolean) => void;
  onVerifyIntegrityChange?: (enabled: boolean) => void;
  onManageDevices?: () => void;
  trustedDevicesCount?: number;
}

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({
  requirePairing = true,
  encryptTransfers = true,
  verifyIntegrity = true,
  onRequirePairingChange,
  onEncryptTransfersChange,
  onVerifyIntegrityChange,
  onManageDevices,
  trustedDevicesCount = 0
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const ToggleSwitch: React.FC<{
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    label: string;
    description: string;
    icon: React.ReactNode;
    recommended?: boolean;
  }> = ({ enabled, onChange, label, description, icon, recommended }) => (
    <div className="flex items-start gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-300">
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {label}
          </h3>
          {recommended && (
            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
              推荐
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </div>

      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
          }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
        />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          安全设置
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          配置文件传输的安全选项
        </p>
      </div>

      {/* 基础设置 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          基础设置
        </h3>

        <ToggleSwitch
          enabled={requirePairing}
          onChange={onRequirePairingChange || (() => { })}
          label="需要配对才能连接"
          description="只允许已配对的设备发送和接收文件"
          recommended
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          }
        />

        <ToggleSwitch
          enabled={encryptTransfers}
          onChange={onEncryptTransfersChange || (() => { })}
          label="加密文件传输"
          description="使用 AES-256-GCM 加密所有传输的文件"
          recommended
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
        />

        <ToggleSwitch
          enabled={verifyIntegrity}
          onChange={onVerifyIntegrityChange || (() => { })}
          label="验证文件完整性"
          description="使用 SHA-256 哈希验证文件未被篡改"
          recommended
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* 受信任设备 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center text-green-600 dark:text-green-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                受信任设备
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {trustedDevicesCount} 个已配对设备
              </p>
            </div>
          </div>

          {onManageDevices && (
            <button
              onClick={onManageDevices}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
            >
              管理设备
            </button>
          )}
        </div>
      </div>

      {/* 高级设置 */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <svg
            className={`w-5 h-5 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-semibold">高级设置</span>
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 pl-7">
            {/* 加密算法信息 */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                加密算法
              </h4>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex justify-between">
                  <span>非对称加密：</span>
                  <span className="font-mono">RSA-2048</span>
                </div>
                <div className="flex justify-between">
                  <span>对称加密：</span>
                  <span className="font-mono">AES-256-GCM</span>
                </div>
                <div className="flex justify-between">
                  <span>哈希算法：</span>
                  <span className="font-mono">SHA-256</span>
                </div>
                <div className="flex justify-between">
                  <span>数字签名：</span>
                  <span className="font-mono">RSA-PSS</span>
                </div>
              </div>
            </div>

            {/* 安全提示 */}
            <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-semibold mb-1">安全建议</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>始终启用加密传输以保护隐私</li>
                    <li>定期检查受信任设备列表</li>
                    <li>移除不再使用的设备</li>
                    <li>不要与陌生设备配对</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
