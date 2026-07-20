import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const testsWebRoot = dirname(fileURLToPath(import.meta.url));
const webAppRoot = join(testsWebRoot, "../../apps/web");
const webSrc = join(webAppRoot, "src");

export default defineConfig({
  root: webAppRoot,
  plugins: [tsconfigPaths({ projects: [join(webAppRoot, "tsconfig.json")] }), react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@tanstack/react-query": join(webAppRoot, "node_modules/@tanstack/react-query"),
      "@tanstack/react-router": join(webAppRoot, "node_modules/@tanstack/react-router"),
      "@": webSrc,
      "@modules": join(webSrc, "modules"),
      "@hooks": join(webSrc, "hooks"),
      "@integrations": join(webSrc, "integrations"),
      "@lib": join(webSrc, "lib"),
      "@utils": join(webSrc, "utils"),
      src: webSrc,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: [
      join(testsWebRoot, "integration/**/*.{test,spec}.{ts,tsx}"),
      join(testsWebRoot, "e2e/**/*.{test,spec}.{ts,tsx}"),
    ],
  },
});
