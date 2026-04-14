import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ command, isSsrBuild }) => {
  // GitHub Actions 使用绝对路径
  const isCI = process.env.GITHUB_ACTIONS === 'true' || 
               process.env.CI === 'true' ||
               process.argv.includes('--ci');
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
