import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

// base 取决于部署目标：
// - 本地 dev (vite serve)：服务在根路径 → '/'
// - GitHub Pages (production, main 分支)：服务在 https://<user>.github.io/Urlaub/ → '/Urlaub/'
// - Cloudflare Pages (preview, dev 分支)：服务在根域名 (*.pages.dev) → '/'
//   Cloudflare 构建时自动注入 CF_PAGES=1，以此区分。
export default defineConfig(({ command }) => {
  const isBuild = command === 'build'
  const isCloudflare = !!process.env.CF_PAGES
  return {
    plugins: [react(), cloudflare()],
    base: isBuild && !isCloudflare ? '/Urlaub/' : '/',
  };
})