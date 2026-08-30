import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Dev server on :3000, FastAPI on :8000.
 *
 * `/api` is proxied rather than called cross-origin so the browser sees one
 * origin in development exactly as it does in production, where FastAPI mounts
 * the built `dist/` at `/` and serves both from :8000. That keeps the frontend
 * free of any base-URL switching: every request is a relative `/api/...` call.
 *
 * `VITE_API_TARGET` overrides the backend address for a non-local API.
 */
const API_TARGET = process.env.VITE_API_TARGET ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  build: {
    // FastAPI serves this directory when it exists - see `FRONTEND_DIST` in
    // App/Api.py. Keep the two in step if you move it.
    outDir: "dist",
    sourcemap: true,
  },
});
