import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/dev-api': {
        target: 'https://pmltkfluqk.execute-api.us-east-1.amazonaws.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dev-api/, '/dev/api')
      },
      '/live-api': {
        target: 'https://pmltkfluqk.execute-api.us-east-1.amazonaws.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/live-api/, '/api')
      }
    }
  }
})
