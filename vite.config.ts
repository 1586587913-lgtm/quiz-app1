import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(() => {
  // GitHub Pages 使用 /quiz-app1/ 路径
  const base = '/quiz-app1/';
  
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
