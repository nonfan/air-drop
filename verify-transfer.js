/**
 * 验证传输文件的完整性
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const hashes = {
  "small": "929569414a112482be557468493282d9ce66dad7f8ab68d0e1db23f80383abd2",
  "medium": "e844fa6864f864679bff66d4de74f316a21e7f7e42de0a58a5453bc62243bdc0",
  "large": "e3159f1d940b439f5e2e5e6c1045c771f73801b3541dc958de0593222a7aa86d"
};

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
