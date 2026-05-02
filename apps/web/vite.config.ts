import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const config = defineConfig(() => {
  const isTest = process.env.VITEST === "true";

  return {
    plugins: isTest
      ? [tsconfigPaths({ projects: ["./tsconfig.json"] }), viteReact()]
      : [
          devtools(),
          nitro({ rollupConfig: { external: [/^@sentry\//] } }),
          tsconfigPaths({ projects: ["./tsconfig.json"] }),
          tailwindcss(),
          tanstackStart({
            // Avoid lazy `?tsr-split=component` chunks — in dev they can 404 (SSR catches the URL
            // before Vite transforms it), causing "Failed to fetch dynamically imported module".
            router: {
              codeSplittingOptions: {
                defaultBehavior: [],
              },
            },
          }),
          viteReact(),
        ],
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    test: {
      environment: "jsdom",
      globals: true,
      include: ["src/tests/**/*.test.ts", "src/tests/**/*.test.tsx"],
    },
  };
});

export default config;
