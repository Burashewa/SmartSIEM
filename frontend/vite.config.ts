import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const workerTarget = env.VITE_PROXY_WORKER_TARGET || 'http://127.0.0.1:4000'
  const collectorTarget = env.VITE_PROXY_COLLECTOR_TARGET || 'http://127.0.0.1:5000'

  const backendProxy = {
    '/api/worker': {
      target: workerTarget,
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/api\/worker/, '') || '/',
    },
    '/api/collector': {
      target: collectorTarget,
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/api\/collector/, '') || '/',
    },
  } as const

  return {
    plugins: [
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },

    server: {
      proxy: { ...backendProxy },
    },

    preview: {
      proxy: { ...backendProxy },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})
