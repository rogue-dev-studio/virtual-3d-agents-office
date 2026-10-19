import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  publicDir: "public",
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    target: "es2020",
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
        },
      },
    },
  },
  test: {
    include: ["tests/unit/**/*.test.js"],
    environment: "node",
  },
});
