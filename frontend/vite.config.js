import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_') // Load only VITE_ prefixed env vars
  const API_BASE_URL = env.VITE_API_BASE_URL || 'http://localhost:3001/api'

  return {
    plugins: [react()],
    preview: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '.trycloudflare.com',
        'accidents-innocent-multimedia-projected.trycloudflare.com',
      ],
      proxy: {
        '/api': {
          target: API_BASE_URL.replace('/api', ''), // http://localhost:3001
          changeOrigin: true,
          // No rewrite — backend routes are already mounted under /api/*
        },
      },
    },
  }
})
