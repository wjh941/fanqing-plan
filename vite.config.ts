import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// host: true 让手机在同一局域网下也能打开(移动端优先调试)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5199,
  },
})
