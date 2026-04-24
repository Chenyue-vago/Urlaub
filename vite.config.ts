import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 把项目站点服务在 https://<user>.github.io/<repo>/ 路径下，
// 因此生产构建里的所有静态资源 URL 都需要带这个仓库名前缀。
// dev 模式（vite serve）下还在根路径，所以仅 build 时设。
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/Urlaub/' : '/',
}))
