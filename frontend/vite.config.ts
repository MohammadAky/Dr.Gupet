import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Port 5173 is assumed by the backend CORS_ORIGINS and FRONTEND_PAYMENT_RESULT_URL.
export default defineConfig(({ mode }) => {
  const localApiTarget =
    loadEnv(mode, '.', 'DRGUPET_').DRGUPET_LOCAL_API_TARGET || 'http://127.0.0.1:3000';
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: localApiTarget, changeOrigin: true },
        '/uploads': { target: localApiTarget, changeOrigin: true },
      },
    },
    preview: { port: 5173 },
  };
});
