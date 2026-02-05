/**
 * 端口配置检查脚本
 * 验证 package.json, vite.config.ts 和 window.ts 中的端口配置是否一致
 */

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('端口配置检查');
console.log('========================================\n');

let hasError = false;

// 1. 检查 package.json
console.log('[1/3] 检查 package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const devElectronScript = packageJson.scripts['dev:electron'];
  const portMatch = devElectronScript.match(/localhost:(\d+)/);
  
  if (portMatch) {
    const port = portMatch[1];
    console.log(`  ✓ 找到端口: ${port}`);
    console.log(`  位置: scripts.dev:electron`);
    
    if (port !== '5173') {
      console.log(`  ⚠️  警告: 端口不是标准的 5173`);
    }
  } else {
    console.log('  ✗ 未找到端口配置');
    hasError = true;
  }
} catch (error) {
  console.log(`  ✗ 读取失败: ${error.message}`);
  hasError = true;
}

console.log('');

// 2. 检查 vite.config.ts
console.log('[2/3] 检查 vite.config.ts...');
try {
  const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
  const portMatch = viteConfig.match(/port:\s*(\d+)/);
  
  if (portMatch) {
    const port = portMatch[1];
    console.log(`  ✓ 找到端口: ${port}`);
    console.log(`  位置: server.port`);
    
    if (port !== '5173') {
      console.log(`  ⚠️  警告: 端口不是标准的 5173`);
    }
  } else {
    console.log('  ✗ 未找到端口配置');
    hasError = true;
  }
} catch (error) {
  console.log(`  ✗ 读取失败: ${error.message}`);
  hasError = true;
}

console.log('');

// 3. 检查 src/main/window.ts
console.log('[3/3] 检查 src/main/window.ts...');
try {
  const windowTs = fs.readFileSync('src/main/window.ts', 'utf8');
  const portMatch = windowTs.match(/VITE_DEV_PORT\s*=\s*(\d+)/);
  
  if (portMatch) {
    const port = portMatch[1];
    console.log(`  ✓ 找到端口: ${port}`);
    console.log(`  位置: VITE_DEV_PORT 常量`);
    
    if (port !== '5173') {
      console.log(`  ⚠️  警告: 端口不是标准的 5173`);
    }
  } else {
    console.log('  ✗ 未找到端口配置');
    hasError = true;
  }
} catch (error) {
  console.log(`  ✗ 读取失败: ${error.message}`);
  hasError = true;
}

console.log('');
console.log('========================================');

if (hasError) {
  console.log('❌ 检查失败：发现配置问题');
  console.log('');
  console.log('请确保以下文件中的端口配置一致：');
  console.log('1. package.json - scripts.dev:electron');
  console.log('2. vite.config.ts - server.port');
  console.log('3. src/main/window.ts - VITE_DEV_PORT');
  console.log('');
  console.log('详细信息请查看: docs/PORT_CONFIGURATION.md');
  process.exit(1);
} else {
  console.log('✅ 检查通过：所有端口配置一致');
  console.log('');
  console.log('当前配置：');
  console.log('  Vite Dev Server: 5173');
  console.log('  Web Server: 8888');
  console.log('  Transfer Server: 3001');
}

console.log('========================================');
