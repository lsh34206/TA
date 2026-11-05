import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
        // 접속 IP가 접근 권한이므로 실제 클라이언트 IP를 X-Forwarded-For로 넘긴다
        // (백엔드 .env의 TRUST_PROXY=loopback 과 짝)
        xfwd: true,
      },
    },
  },
})
