import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, type ViteUserConfig } from "vitest/config";

export default defineConfig({
  // `react()` is typed against the standalone `vite` package while vitest bundles
  // its own (rolldown-flavored) vite types; the plugin is runtime-compatible, so
  // realign the type to vitest's expected `plugins` shape.
  plugins: [react()] as ViteUserConfig["plugins"],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/tests/setup.ts"],
    include: ["src/tests/**/*.{test,spec}.{ts,tsx}"],
  },
});
