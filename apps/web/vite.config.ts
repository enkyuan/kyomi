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
          tsconfigPaths({ projects: ["./tsconfig.json"] }),
          // TanStack Start must register the server-fn resolver and environments before Nitro’s
          // dev worker wires `fetch`; otherwise `#tanstack-start-server-fn-resolver` stays on the
          // package stub and `getInboxViewCount` etc. 500 with "Cannot read properties of undefined (reading 'method')".
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
          tailwindcss(),
          nitro({ rollupConfig: { external: [/^@sentry\//] } }),
        ],
    resolve: {
      dedupe: ["react", "react-dom"],
    },
  };
});

export default config;
