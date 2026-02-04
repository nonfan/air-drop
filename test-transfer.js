/**
 * 文件传输功能测试脚本
 * 用于快速验证传输功能是否正常
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// 配置
const TARGET_IP = '127.0.0.1';
const TARGET_PORT = 3001;
const TEST_FILE = 'test-file.txt';
const TEST_CONTENT = 'Hello, this is a test file for transfer functionality!\n'.repeat(100);

// 创建测试文件
function createTestFile() {
  console.log('📝 Creating test file...');
  fs.writeFileSync(TEST_FILE, TEST_CONTENT);
  const stats = fs.statSync(TEST_FILE);
  console.log(`✅ Test file created: ${TEST_FILE} (${stats.size} bytes)`);
  return stats.size;
}

// 测试连接
function testConnection() {
  return new Promise((resolve, reject) => {
    console.log(`🔌 Testing connection to ${TARGET_IP}:${TARGET_PORT}...`);
    
    const options = {
      hostname: TARGET_IP,
      port: TARGET_PORT,
      path: '/api/ping',
      method: 'GET',
      timeout: 3000
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Connection successful');
        resolve(true);
      } else {
        console.log(`❌ Connection failed: ${res.statusCode}`);
        resolve(false);
      }
    });

    req.on('error', (error) => {
      console.log(`❌ Connection error: ${error.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      console.log('❌ Connection timeout');
      resolve(false);
    });

    req.end();
  });
}

// 发送传输请求
function sendTransferRequest(fileSize) {
  return new Promise((resolve, reject) => {
    console.log('📤 Sending transfer request...');
    
    const data = JSON.stringify({
      transferId: 'test-transfer-' + Date.now(),
      fileName: TEST_FILE,
      fileSize: fileSize,
      fromDeviceId: 'test-device',
      fromDeviceName: 'Test Device'
    });

    const options = {
      hostname: TARGET_IP,
      port: TARGET_PORT,
      path: '/api/transfer/request',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', chunk => {
        body += chunk.toString();
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.success) {
            console.log(`✅ Transfer request accepted: ${result.transferId}`);
            resolve(result.transferId);
          } else {
            console.log(`❌ Transfer request failed: ${result.error}`);
            reject(new Error(result.error));
          }
        } catch (error) {
          console.log(`❌ Failed to parse response: ${error.message}`);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Request error: ${error.message}`);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// 主测试函数
async function runTest() {
  console.log('🚀 Starting file transfer test...\n');

  try {
    // 1. 创建测试文件
    const fileSize = createTestFile();
    console.log('');

    // 2. 测试连接
    const connected = await testConnection();
    if (!connected) {
      console.log('\n❌ Test failed: Cannot connect to transfer server');
      console.log('💡 Make sure the application is running on port 3001');
      return;
    }
    console.log('');

    // 3. 发送传输请求
    const transferId = await sendTransferRequest(fileSize);
    console.log('');

    // 4. 测试完成
    console.log('✅ Basic test completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Check if the transfer request appears in the receiver app');
    console.log('2. Accept the transfer in the receiver app');
    console.log('3. Verify the file is received correctly');
    console.log('\n💡 For full testing, use the TESTING_GUIDE.md');

  } catch (error) {
    console.log(`\n❌ Test failed: ${error.message}`);
    console.log('\n📋 Troubleshooting:');
    console.log('1. Make sure the application is running');
    console.log('2. Check if port 3001 is accessible');
    console.log('3. Check firewall settings');
    console.log('4. Review the application logs');
  } finally {
    // 清理测试文件
    if (fs.existsSync(TEST_FILE)) {
      fs.unlinkSync(TEST_FILE);
      console.log(`\n🧹 Cleaned up test file: ${TEST_FILE}`);
    }
  }
}

// 运行测试
runTest();
