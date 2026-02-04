/**
 * 端到端测试辅助脚本
 * 用于快速验证文件传输功能
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('='.repeat(60));
console.log('Airdrop 端到端测试辅助工具');
console.log('='.repeat(60));
console.log();

// 1. 创建测试文件
console.log('📁 创建测试文件...');

const testDir = path.join(__dirname, 'test-files');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir);
  console.log('✅ 创建测试目录:', testDir);
}

// 创建小文件（1KB）
const smallFile = path.join(testDir, 'test-small.txt');
const smallContent = 'This is a test file for Airdrop transfer.\n'.repeat(20);
fs.writeFileSync(smallFile, smallContent);
console.log('✅ 创建小文件:', smallFile, `(${fs.statSync(smallFile).size} bytes)`);

// 创建中等文件（1MB）
const mediumFile = path.join(testDir, 'test-medium.bin');
const mediumBuffer = crypto.randomBytes(1024 * 1024);
fs.writeFileSync(mediumFile, mediumBuffer);
console.log('✅ 创建中等文件:', mediumFile, `(${(fs.statSync(mediumFile).size / 1024 / 1024).toFixed(2)} MB)`);

// 创建大文件（10MB）
const largeFile = path.join(testDir, 'test-large.bin');
const largeBuffer = crypto.randomBytes(10 * 1024 * 1024);
fs.writeFileSync(largeFile, largeBuffer);
console.log('✅ 创建大文件:', largeFile, `(${(fs.statSync(largeFile).size / 1024 / 1024).toFixed(2)} MB)`);

console.log();

// 2. 计算文件哈希（用于验证完整性）
console.log('🔐 计算文件哈希...');

function calculateHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

const hashes = {
  small: calculateHash(smallFile),
  medium: calculateHash(mediumFile),
  large: calculateHash(largeFile)
};

console.log('小文件 SHA256:', hashes.small);
console.log('中等文件 SHA256:', hashes.medium);
console.log('大文件 SHA256:', hashes.large);

// 保存哈希值
const hashFile = path.join(testDir, 'hashes.json');
fs.writeFileSync(hashFile, JSON.stringify(hashes, null, 2));
console.log('✅ 保存哈希值:', hashFile);

console.log();

// 3. 显示测试说明
console.log('📋 测试步骤：');
console.log();
console.log('1. 启动第一个实例：');
console.log('   npm run dev');
console.log();
console.log('2. 启动第二个实例（新终端）：');
console.log('   set ELECTRON_USER_DATA=./test-instance-2');
console.log('   npm run dev');
console.log();
console.log('3. 在实例 1 中发送文件：');
console.log('   - 选择文件:', smallFile);
console.log('   - 选择目标设备（实例 2）');
console.log('   - 点击发送');
console.log();
console.log('4. 在实例 2 中接受文件：');
console.log('   - 等待传输请求');
console.log('   - 点击接受');
console.log('   - 等待传输完成');
console.log();
console.log('5. 验证文件完整性：');
console.log('   node verify-transfer.js <接收的文件路径>');
console.log();

// 4. 创建验证脚本
const verifyScript = `/**
 * 验证传输文件的完整性
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const hashes = ${JSON.stringify(hashes, null, 2)};

function calculateHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('❌ 请提供文件路径');
  console.log('用法: node verify-transfer.js <文件路径>');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error('❌ 文件不存在:', filePath);
  process.exit(1);
}

const fileName = path.basename(filePath);
const hash = calculateHash(filePath);

console.log('文件:', fileName);
console.log('计算的哈希:', hash);

let expectedHash;
if (fileName.includes('small')) {
  expectedHash = hashes.small;
} else if (fileName.includes('medium')) {
  expectedHash = hashes.medium;
} else if (fileName.includes('large')) {
  expectedHash = hashes.large;
} else {
  console.log('⚠️  无法确定文件类型，无法验证');
  process.exit(0);
}

console.log('期望的哈希:', expectedHash);

if (hash === expectedHash) {
  console.log('✅ 文件完整性验证通过！');
  process.exit(0);
} else {
  console.log('❌ 文件完整性验证失败！');
  process.exit(1);
}
`;

fs.writeFileSync('verify-transfer.js', verifyScript);
console.log('✅ 创建验证脚本: verify-transfer.js');
console.log();

// 5. 显示调试命令
console.log('🔧 调试命令：');
console.log();
console.log('查看设备列表（在开发者工具控制台）：');
console.log('  window.electron.ipcRenderer.invoke("get-devices")');
console.log();
console.log('监听传输事件（在开发者工具控制台）：');
console.log('  window.electron.ipcRenderer.on("transfer-created", (e, t) => console.log("Created:", t))');
console.log('  window.electron.ipcRenderer.on("transfer-progress", (e, p) => console.log("Progress:", p))');
console.log('  window.electron.ipcRenderer.on("transfer-complete", (e, r) => console.log("Complete:", r))');
console.log();
console.log('自动接受传输（在实例 2 的开发者工具控制台）：');
console.log('  window.electron.ipcRenderer.on("transfer-request", (e, r) => {');
console.log('    console.log("Request:", r);');
console.log('    window.electron.ipcRenderer.invoke("accept-transfer", r.transferId);');
console.log('  })');
console.log();

console.log('='.repeat(60));
console.log('✅ 测试准备完成！');
console.log('='.repeat(60));
console.log();
console.log('📖 详细测试指南: E2E_TEST_EXECUTION.md');
console.log();
