/**
 * 安全设置页面视图
 * 集成所有安全 UI 组件
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SecuritySettings,
  PairingDialog,
  TrustedDevicesList,
  PermissionsDialog,
  Permission
} from '../../shared/components';
import { useSecurityService } from '../hooks/useSecurityService';
import { Toast } from '../components/common/Toast';

// 获取设备 ID（从 localStorage 或生成新的）
const getDeviceId = (): string => {
  const stored = localStorage.getItem('deviceId');
  if (stored) return stored;

  const newId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('deviceId', newId);
  return newId;
};

export function SecuritySettingsPageView() {
  const navigate = useNavigate();
  const deviceId = getDeviceId();

  // 使用安全服务 Hook
  const securityService = useSecurityService(deviceId);

  // 本地状态
  const [showPairingDialog, setShowPairingDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 显示 Toast 通知
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // 返回设置页面
  const handleBack = useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  // 处理设置更新
  const handleRequirePairingChange = useCallback((enabled: boolean) => {
    securityService.updateSettings({ requirePairing: enabled });
    showToast('设置已保存');
  }, [securityService, showToast]);

  const handleEncryptTransfersChange = useCallback((enabled: boolean) => {
    securityService.updateSettings({ encryptTransfers: enabled });
    showToast('设置已保存');
  }, [securityService, showToast]);

  const handleVerifyIntegrityChange = useCallback((enabled: boolean) => {
    securityService.updateSettings({ verifyIntegrity: enabled });
    showToast('设置已保存');
  }, [securityService, showToast]);

  // 处理配对请求
  const handlePairDevice = useCallback(() => {
    setShowPairingDialog(true);
  }, []);

  // 处理配对验证
  const handlePairingVerify = useCallback(async (code: string) => {
    try {
      // 这里应该从对方设备获取设备 ID 和名称，暂时使用占位符
      const targetDeviceId = `device-${Date.now()}`;
      const deviceName = `Device-${code.slice(0, 4)}`;
      const success = await securityService.verifyPairingCode(targetDeviceId, code, deviceName);

      if (success) {
        showToast('设备配对成功');
        setShowPairingDialog(false);
        await securityService.refreshDevices();
      } else {
        showToast('配对失败，请检查配对码');
      }
    } catch (error) {
      console.error('配对失败:', error);
      showToast('配对失败，请重试');
    }
  }, [securityService, showToast]);

  // 处理配对取消
  const handlePairingCancel = useCallback(() => {
    setShowPairingDialog(false);
  }, []);

  // 处理移除设备
  const handleRemoveDevice = useCallback(async (deviceId: string) => {
    try {
      await securityService.removeDevice(deviceId);
      showToast('设备已移除');
      await securityService.refreshDevices();
    } catch (error) {
      console.error('移除设备失败:', error);
      showToast('移除设备失败');
    }
  }, [securityService, showToast]);

  // 处理管理权限
  const handleManagePermissions = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setShowPermissionsDialog(true);
  }, []);

  // 处理权限保存
  const handlePermissionsSave = useCallback((permissions: Permission[], expiresAt?: number) => {
    if (!selectedDeviceId) return;

    try {
      securityService.grantPermissions(selectedDeviceId, permissions, expiresAt);
      showToast('权限已更新');
      setShowPermissionsDialog(false);
      setSelectedDeviceId(null);
    } catch (error) {
      console.error('更新权限失败:', error);
      showToast('更新权限失败');
    }
  }, [selectedDeviceId, securityService, showToast]);

  // 处理权限对话框关闭
  const handlePermissionsClose = useCallback(() => {
    setShowPermissionsDialog(false);
    setSelectedDeviceId(null);
  }, []);

  // 获取选中设备的信息
  const selectedDevice = selectedDeviceId
    ? securityService.devices.find(d => d.deviceId === selectedDeviceId)
    : null;

  const selectedDevicePermissions = selectedDeviceId
    ? securityService.getDevicePermissions(selectedDeviceId)
    : null;

  return (
    <div className="w-full h-full overflow-y-auto bg-background">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-10 bg-secondary border-b border-divider">
        <div className="flex items-center px-4 py-3">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-hover rounded-lg transition-colors"
            aria-label="返回"
          >
            <svg className="w-5 h-5 text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="ml-2 text-lg font-semibold text-foreground">安全与隐私</h1>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="px-4 py-6 space-y-6 pb-20">
        {/* 加载状态 */}
        {securityService.isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
        )}

        {/* 错误提示 */}
        {securityService.error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-500">错误</p>
                <p className="text-sm text-red-400 mt-1">{securityService.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* 安全设置 */}
        {securityService.isInitialized && (
          <>
            <div>
              <h2 className="text-xs font-medium text-muted mb-3 px-1">安全选项</h2>
              <SecuritySettings
                requirePairing={securityService.settings.requirePairing}
                encryptTransfers={securityService.settings.encryptTransfers}
                verifyIntegrity={securityService.settings.verifyIntegrity}
                onRequirePairingChange={handleRequirePairingChange}
                onEncryptTransfersChange={handleEncryptTransfersChange}
                onVerifyIntegrityChange={handleVerifyIntegrityChange}
                onManageDevices={handlePairDevice}
                trustedDevicesCount={securityService.devices.length}
              />
            </div>

            {/* 受信任设备列表 */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-xs font-medium text-muted">受信任的设备</h2>
                <button
                  onClick={handlePairDevice}
                  className="text-xs font-medium text-accent hover:text-accent/80 transition-colors"
                >
                  添加设备
                </button>
              </div>
              <TrustedDevicesList
                devices={securityService.devices}
                onRemove={handleRemoveDevice}
                onManagePermissions={handleManagePermissions}
              />
            </div>

            {/* 安全提示 */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-500">安全提示</p>
                  <ul className="text-sm text-blue-400 mt-2 space-y-1 list-disc list-inside">
                    <li>启用加密传输可保护您的文件安全</li>
                    <li>设备配对后才能进行文件传输</li>
                    <li>定期检查受信任设备列表</li>
                    <li>不要与不信任的设备共享配对码</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 配对对话框 */}
      {showPairingDialog && (
        <PairingDialog
          isOpen={showPairingDialog}
          mode="verify"
          onVerify={handlePairingVerify}
          onCancel={handlePairingCancel}
          onClose={handlePairingCancel}
        />
      )}

      {/* 权限管理对话框 */}
      {showPermissionsDialog && selectedDeviceId && selectedDevice && (
        <PermissionsDialog
          isOpen={showPermissionsDialog}
          deviceId={selectedDeviceId}
          deviceName={selectedDevice.deviceName}
          permissions={selectedDevicePermissions}
          onSave={handlePermissionsSave}
          onClose={handlePermissionsClose}
        />
      )}

      {/* Toast 通知 */}
      <Toast message={toastMessage} />
    </div>
  );
}
