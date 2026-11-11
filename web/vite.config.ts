/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Point the dev server at a Frigate instance, eg PROXY_HOST=192.168.1.10:5000
const proxyHost = process.env.PROXY_HOST || "localhost:5000";

export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: `http://${proxyHost}`,
        ws: true,
      },
      "/vod": {
        target: `http://${proxyHost}`,
      },
      "/clips": {
        target: `http://${proxyHost}`,
      },
      "/exports": {
        target: `http://${proxyHost}`,
      },
      "/ws": {
        target: `ws://${proxyHost}`,
        ws: true,
      },
      "/live": {
        target: `ws://${proxyHost}`,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  plugins: [vue()],
  experimental: {
    // Frigate's nginx swaps /BASE_PATH/ in index.html for the real base
    // (eg the Home Assistant ingress path), but its rewrite rules do not
    // cover every way a bundler writes URLs inside JS. Assets referenced
    // from JS and CSS are resolved relative to the file instead, which works
    // under any base path without relying on nginx.
    renderBuiltUrl(_filename, { hostType }) {
      return hostType === "html" ? undefined : { relative: true };
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
