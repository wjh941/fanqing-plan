import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import legacy from '@vitejs/plugin-legacy'

// GitHub Pages 部署在 /fanqing-plan/ 子路径下,用相对资源路径;
// 其他平台(Vercel / EdgeOne)保持根路径。构建时通过环境变量 GITHUB_PAGES=1 区分。
// legacy 插件为老设备(微信 X5 内核、旧 iOS)生成降级产物,避免白屏。
// host: true 让手机在同一局域网下也能打开(移动端优先调试)
export default defineConfig({
  base: process.env.GITHUB_PAGES === '1' ? './' : '/',
  plugins: [
    react(),
    tailwindcss(),
    legacy({
      targets: ['chrome >= 70', 'safari >= 12', 'firefox >= 78'],
      modernPolyfills: true,
    }),
  ],
  build: {
    target: 'es2017',
  },
  server: {
    host: true,
    port: 5199,
  },
})
