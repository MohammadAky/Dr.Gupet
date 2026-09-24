import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Port 5173 is assumed by the backend CORS_ORIGINS and FRONTEND_PAYMENT_RESULT_URL.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  preview: { port: 5173 },
});
