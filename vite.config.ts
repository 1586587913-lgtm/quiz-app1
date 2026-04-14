import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ command, isSsrBuild }) => {
  // GitHub Actions 使用绝对路径
  // 通过检测命令行参数判断是否在 CI 环境
  const isCI = process.env.GITHUB_ACTIONS === 'true' || 
               process.env.CI === 'true' ||
               process.argv.includes('--ci') ||
               process.cwd().includes('github');
  const base = isCI ? '/quiz-app1/' : './';
  
  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['pdfjs-dist'],
    },
    worker: {
      format: 'es',
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
    },
  };
});
