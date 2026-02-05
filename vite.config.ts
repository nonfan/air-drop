import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer')
    }
  },
  server: {
    // ⚠️ 端口配置：修改此端口时必须同步更新
    // 1. package.json - dev:electron 中的 wait-on URL
    // 2. src/main/window.ts - loadURL 中的端口
    port: 5173,
    strictPort: false,
    host: 'localhost'  // 使用 localhost 避免权限问题
  }
})
