import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";



export default defineConfig(({ mode }) => {
 const localApiTarget = loadEnv(mode, '.', 'DRGUPET_').DRGUPET_LOCAL_API_TARGET || 'http://127.0.0.1:3000';
 return {
  plugins: [react()],
  publicDir: resolve(import.meta.dirname, "../frontend/public"),
  server: {
    port: 5174,
    strictPort: true,
    proxy: { "/api": localApiTarget, "/uploads": localApiTarget },
  },
  preview: { port: 5174, strictPort: true },
};
});
