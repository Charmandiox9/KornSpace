import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  const envDirectory = resolve(process.cwd(), '..');
  const frontendEnvironment = loadEnv(mode, envDirectory, 'VITE_');
  const apiProxyTarget = process.env.VITE_API_PROXY_TARGET
    ?? frontendEnvironment.VITE_API_BASE_URL
    ?? 'http://localhost:3000';

  return {
    envDir: envDirectory,
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': apiProxyTarget,
        '/graphql': apiProxyTarget,
      },
    },
  };
});
