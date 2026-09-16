import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages 部署在 /fanqing-plan/ 子路径下,用相对资源路径;
// 其他平台(Vercel / EdgeOne)保持根路径。构建时通过环境变量 GITHUB_PAGES=1 区分。
// 兼容策略:单包 + es2017 语法目标(esbuild 自动降级可选链/空值合并/类字段等),
// 不用 plugin-legacy 双包——其 SystemJS 降级产物与 React 19 组合会渲染崩溃(#130)。
// host: true 让手机在同一局域网下也能打开(移动端优先调试)
export default defineConfig({
  base: process.env.GITHUB_PAGES === '1' ? './' : '/',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2017',
  },
  server: {
    host: true,
    port: 5199,
  },
})
