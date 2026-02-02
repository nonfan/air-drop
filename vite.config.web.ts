import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    viteSingleFile()
  ],
  root: 'src/web',
  base: '/',
  resolve: {
    alias: {
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom')
    },
    dedupe: ['react', 'react-dom']
  },
  server: {
    port: 5174,
    strictPort: true,
    cors: true,
    host: '0.0.0.0',  // 允许外部访问
    hmr: {
      host: 'localhost'
    }
  },
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
