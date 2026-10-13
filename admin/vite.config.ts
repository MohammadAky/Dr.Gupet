import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";



export default defineConfig(({ mode }) => {
 const localApiTarget = loadEnv(mode, '.', 'DRGUPET_').DRGUPET_LOCAL_API_TARGET || 'http://127.0.0.1:3000';
 const localProxy = {
   "/api": { target: localApiTarget, changeOrigin: true },
   "/uploads": { target: localApiTarget, changeOrigin: true },
 };
 return {
  plugins: [react(), {
    name: "admin-robots",
    apply: "build",
    generateBundle() {
      // Keep shared artwork while replacing the customer crawl policy in admin output.
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: readFileSync(resolve(import.meta.dirname, "public/robots.txt"), "utf8"),
      });
    },
  }],
  publicDir: resolve(import.meta.dirname, "../frontend/public"),
  server: {
    port: 5174,
    strictPort: true,
    proxy: localProxy,
  },
  preview: { port: 5174, strictPort: true, proxy: localProxy },
};
});
