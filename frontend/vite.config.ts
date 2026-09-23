import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Proxy API requests to backend server during development
    proxy: {
      // proxy /api/* to backend (server default port 3001)
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path // keep the same path
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})

