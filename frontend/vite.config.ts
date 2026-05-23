import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, '..');
  const env = loadEnv(mode, envDir, '');
  const backendHost = env.BACKEND_HOST || 'localhost';
  const backendPort = env.BACKEND_PORT || env.PORT || '5000';
  const frontendPort = Number(env.FRONTEND_PORT || '3001');

  return {
    envDir,
    plugins: [react(), tailwindcss()],
    appType: 'spa',
    server: {
      port: frontendPort,
      proxy: {
        '/api': {
          target: `http://${backendHost}:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
