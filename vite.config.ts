import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base 取决于部署目标，用显式环境变量 DEPLOY_TARGET 区分（合并分支也不会出错）：
// - GitHub Pages (production, main)：GitHub Actions 设 DEPLOY_TARGET=ghpages
//   → 站点服务在 https://<user>.github.io/Urlaub/，资源需带 '/Urlaub/' 前缀
// - 其它情况（本地 dev、Cloudflare 预览）：服务在根路径 → '/'
export default defineConfig(() => ({
  plugins: [react()],
  base: process.env.DEPLOY_TARGET === 'ghpages' ? '/Urlaub/' : '/',
}))
