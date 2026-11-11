/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";

// Point the dev server at a Frigate instance, eg PROXY_HOST=192.168.1.10:5000
const proxyHost = process.env.PROXY_HOST || "localhost:5000";

const schemaMarkdownStub = fileURLToPath(
  new URL("./src/components/config/schemaMarkdown.ts", import.meta.url),
);

/**
 * codemirror-json-schema renders schema descriptions with markdown-it and
 * the shiki highlighter, which more than doubles the config editor chunk.
 * Swap that one module for a small renderer of our own.
 */
function slimSchemaMarkdown(): Plugin {
  return {
    name: "frigate:slim-schema-markdown",
    enforce: "pre",
    resolveId(source, importer) {
      if (
        importer?.includes("codemirror-json-schema") &&
        /\/utils\/markdown(\.js)?$/.test(source)
      ) {
        return schemaMarkdownStub;
      }
      return null;
    },
  };
}

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
  plugins: [slimSchemaMarkdown(), vue()],
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
