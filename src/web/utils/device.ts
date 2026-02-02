/**
 * 设备相关工具函数
 */

// 从 User Agent 中提取设备型号
export function getDeviceModel(): string {
  const ua = navigator.userAgent;

  // iPhone 检测
  if (/iPhone/.test(ua)) {
    // 尝试提取 iPhone 型号
    const match = ua.match(/iPhone\s?(\d+[,_]\d+)?/);
    if (match) {
      // iPhone 型号映射
      const modelMap: { [key: string]: string } = {
        'iPhone15,2': 'iPhone 14 Pro',
        'iPhone15,3': 'iPhone 14 Pro Max',
        'iPhone14,7': 'iPhone 14',
        'iPhone14,8': 'iPhone 14 Plus',
        'iPhone14,4': 'iPhone 13 mini',
        'iPhone14,5': 'iPhone 13',
        'iPhone14,2': 'iPhone 13 Pro',
        'iPhone14,3': 'iPhone 13 Pro Max',
        'iPhone13,1': 'iPhone 12 mini',
        'iPhone13,2': 'iPhone 12',
        'iPhone13,3': 'iPhone 12 Pro',
        'iPhone13,4': 'iPhone 12 Pro Max',
      };

      const model = match[1]?.replace('_', ',');
      if (model && modelMap[`iPhone${model}`]) {
        return modelMap[`iPhone${model}`];
      }
    }
    return 'iPhone';
  }

  // iPad 检测
  if (/iPad/.test(ua)) {
    if (/iPad.*Pro/.test(ua)) {
      return 'iPad Pro';
    }
    if (/iPad.*Air/.test(ua)) {
      return 'iPad Air';
    }
    if (/iPad.*Mini/.test(ua)) {
      return 'iPad Mini';
    }
    return 'iPad';
  }

  // Android 检测
  if (/Android/.test(ua)) {
    // 尝试提取品牌和型号
    const brands = [
      { pattern: /Xiaomi|MI|Redmi/i, name: '小米' },
      { pattern: /HUAWEI|Honor/i, name: '华为' },
      { pattern: /OPPO/i, name: 'OPPO' },
      { pattern: /vivo/i, name: 'vivo' },
      { pattern: /OnePlus/i, name: '一加' },
      { pattern: /Samsung|SM-/i, name: '三星' },
      { pattern: /Pixel/i, name: 'Google Pixel' },
    ];

    for (const brand of brands) {
      if (brand.pattern.test(ua)) {
        // 尝试提取具体型号
        const modelMatch = ua.match(/\(([^)]+)\)/);
        if (modelMatch) {
          const parts = modelMatch[1].split(';');
          for (const part of parts) {
            const trimmed = part.trim();
            if (brand.pattern.test(trimmed)) {
              return trimmed;
            }
          }
        }
        return brand.name;
      }
    }
    return 'Android 设备';
  }

  // 桌面浏览器检测
  if (/Macintosh|Mac OS X/.test(ua)) {
    if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
      return 'Mac Safari';
    }
    if (/Chrome/.test(ua)) {
      return 'Mac Chrome';
    }
    if (/Firefox/.test(ua)) {
      return 'Mac Firefox';
    }
    return 'Mac';
  }

  if (/Windows/.test(ua)) {
    if (/Edge/.test(ua)) {
      return 'Windows Edge';
    }
    if (/Chrome/.test(ua)) {
      return 'Windows Chrome';
    }
    if (/Firefox/.test(ua)) {
      return 'Windows Firefox';
    }
    return 'Windows PC';
  }

  if (/Linux/.test(ua)) {
    return 'Linux';
  }

  return '未知设备';
}

// 生成设备名称（基于真实设备型号）
export function generateDeviceName(): string {
  const deviceModel = getDeviceModel();
  const randomNum = Math.floor(Math.random() * 1000);

  // 如果是移动设备，添加随机数以区分同型号设备
  if (/iPhone|iPad|Android|小米|华为|OPPO|vivo|一加|三星|Pixel/.test(deviceModel)) {
    return `${deviceModel}-${randomNum}`;
  }

  // 桌面设备直接使用型号
  return deviceModel;
}

// 检测是否为移动设备
export function isMobileDevice(): boolean {
  return window.innerWidth < 768 || /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
