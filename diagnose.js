/**
 * 诊断脚本 - 检查开发环境问题
 */

const http = require('http');
const { execSync } = require('child_process');

console.log('🔍 诊断开发环境...\n');

// 1. 检查 Node.js 版本
console.log('1️⃣ Node.js 版本:');
try {
  const nodeVersion = process.version;
  console.log(`   ✅ ${nodeVersion}\n`);
} catch (error) {
  console.log(`   ❌ 无法获取版本\n`);
}

// 2. 检查端口占用
console.log('2️⃣ 检查端口占用:');
const ports = [5173, 5174, 5175, 8888, 3001];

function checkPort(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`   ⚠️  端口 ${port} 已被占用`);
        resolve(false);
      } else {
        console.log(`   ❌ 端口 ${port} 检查失败: ${err.message}`);
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      console.log(`   ✅ 端口 ${port} 可用`);
      resolve(true);
    });
    
    server.listen(port);
  });
}

async function checkAllPorts() {
  for (const port of ports) {
    await checkPort(port);
  }
  console.log('');
}

// 3. 检查 Vite 开发服务器
function checkViteServer() {
  return new Promise((resolve) => {
    console.log('3️⃣ 检查 Vite 开发服务器:');
    
    const req = http.get('http://localhost:5173', (res) => {
      console.log(`   ✅ Vite 服务器运行中 (状态: ${res.statusCode})\n`);
      resolve(true);
    });
    
    req.on('error', (err) => {
      console.log(`   ❌ Vite 服务器未运行: ${err.message}`);
      console.log('   💡 请先运行: npm run dev:renderer\n');
      resolve(false);
    });
    
    req.setTimeout(2000, () => {
      req.destroy();
      console.log('   ❌ 连接超时\n');
      resolve(false);
    });
  });
}

// 4. 检查构建文件
console.log('4️⃣ 检查构建文件:');
const fs = require('fs');
const path = require('path');

const files = [
  'dist/main/main.js',
  'dist/main/preload.js',
  'dist/renderer/index.html'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    console.log(`   ✅ ${file} (${stats.size} bytes)`);
  } else {
    console.log(`   ❌ ${file} 不存在`);
  }
});
console.log('');

// 5. 检查依赖
console.log('5️⃣ 检查关键依赖:');
const deps = ['electron', 'vite', 'react', 'concurrently'];

deps.forEach(dep => {
  try {
    const packageJson = require(`./node_modules/${dep}/package.json`);
    console.log(`   ✅ ${dep}@${packageJson.version}`);
  } catch (error) {
    console.log(`   ❌ ${dep} 未安装`);
  }
});
console.log('');

// 运行诊断
async function runDiagnosis() {
  await checkAllPorts();
  await checkViteServer();
  
  console.log('📋 诊断完成！\n');
  console.log('💡 建议:');
  console.log('1. 如果 Vite 服务器未运行，先运行: npm run dev:renderer');
  console.log('2. 等待 3-5 秒后，再运行: npm run dev:main');
  console.log('3. 或者直接运行: npm run dev (会自动延迟启动)\n');
  console.log('🔧 如果问题持续，尝试:');
  console.log('1. 删除 node_modules 和 dist 文件夹');
  console.log('2. 运行: npm install');
  console.log('3. 运行: npm run build');
  console.log('4. 再次尝试: npm run dev\n');
}

runDiagnosis();
