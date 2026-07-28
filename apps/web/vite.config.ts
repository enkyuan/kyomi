import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig, transformWithEsbuild } from "vite";
import type { Plugin } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const EMPTY_VENDOR_CHUNK_PACKAGES = new Set(["@tanstack/start-fn-stubs", "better-call", "motion"]);
const STATIC_ASSET_EXTENSIONS = /\.(?:css|js|woff2?|ttf)$/;

function getBaseUiReactChunkName(segments: string[]) {
  const featureIndex = segments[2] === "esm" ? 3 : 2;
  const feature = segments[featureIndex];

  if (!feature) {
    return "vendor-base-ui-react-core";
  }

  if (feature === "merge-props" || feature === "use-render") {
    return "vendor-base-ui-react-core";
  }

  if (feature === "toast") {
    return "vendor-base-ui-react-toast";
  }

  if (feature === "dialog" || feature === "alert-dialog" || feature === "drawer") {
    return "vendor-base-ui-react-dialog";
  }

  return "vendor-base-ui-react-core";
}

function getVendorChunkName(id: string) {
  const marker = "node_modules/";
  const markerIndex = id.lastIndexOf(marker);
  if (markerIndex === -1) {
    return undefined;
  }

  const segments = id.slice(markerIndex + marker.length).split("/");
  const packageName = segments[0]?.startsWith("@") ? `${segments[0]}/${segments[1]}` : segments[0];

  if (!packageName || EMPTY_VENDOR_CHUNK_PACKAGES.has(packageName)) {
    return undefined;
  }

  if (packageName === "@base-ui/react") {
    return getBaseUiReactChunkName(segments);
  }

  return packageName ? `vendor-${packageName.replace(/^@/, "").replaceAll("/", "-")}` : undefined;
}

function staticAssetServiceWorkerPlugin(): Plugin {
  return {
    name: "kyomi-static-asset-service-worker",
    apply: "build",
    enforce: "post",
    async generateBundle(outputOptions, bundle) {
      if (!outputOptions.dir?.includes(".output/public")) {
        return;
      }

      const serviceWorkerSource = await readFile("sw.plugin.ts", "utf8");

      const urls = Object.values(bundle)
        .filter((asset) => asset.fileName.startsWith("assets/"))
        .filter((asset) => STATIC_ASSET_EXTENSIONS.test(asset.fileName))
        .map((asset) => `/${asset.fileName}`)
        .sort();
      const version = createHash("sha256").update(urls.join("\n")).digest("hex").slice(0, 16);

      const source = (
        await transformWithEsbuild(serviceWorkerSource, "sw.plugin.ts", {
          format: "iife",
          loader: "ts",
          target: "esnext",
        })
      ).code
        .replaceAll("__SW_VERSION__", JSON.stringify(version))
        .replaceAll("__STATIC_ASSET_URLS__", JSON.stringify(urls));

      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source,
      });
    },
  };
}

const config = defineConfig(({ command }) => {
  const isTest = process.env.VITEST === "true";
  const isDev = command === "serve";

  return {
    build: {
      target: "esnext",
      cssMinify: "lightningcss",
      modulePreload: {
        polyfill: false,
      },
      rollupOptions: {
        output: {
          manualChunks: getVendorChunkName,
        },
      },
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "@kyomi/ui/icons/mingcute",
        "@kyomi/ui/atoms/motion",
        "@tanstack/react-query",
        "@tanstack/react-router",
        "@tanstack/react-virtual",
      ],
    },
    plugins: isTest
      ? [tsconfigPaths({ projects: ["./tsconfig.json"] }), viteReact()]
      : [
          devtools(),
          tsconfigPaths({ projects: ["./tsconfig.json"] }),
          // TanStack Start must register the server-fn resolver and environments before Nitro’s
          // dev worker wires `fetch`; otherwise `#tanstack-start-server-fn-resolver` stays on the
          // package stub and `getInboxViewCount` etc. 500 with "Cannot read properties of undefined (reading 'method')".
          tanstackStart({
            router: {
              codeSplittingOptions: {
                // Avoid lazy `?tsr-split=component` chunks in dev: SSR can catch the URL before
                // Vite transforms it, causing "Failed to fetch dynamically imported module".
                // Production should still split route components so heavy screens do not land in
                // the initial app chunk.
                defaultBehavior: isDev
                  ? []
                  : [
                      ["component"],
                      ["pendingComponent"],
                      ["errorComponent"],
                      ["notFoundComponent"],
                    ],
              },
            },
          }),
          viteReact(),
          tailwindcss(),
          staticAssetServiceWorkerPlugin(),
          nitro({ rollupConfig: { external: [/^@sentry\//] } }),
        ],
    resolve: {
      alias: {
        "@styles": fileURLToPath(new URL("./src/styles", import.meta.url)),
      },
      dedupe: ["react", "react-dom"],
    },
  };
});

export default config;
