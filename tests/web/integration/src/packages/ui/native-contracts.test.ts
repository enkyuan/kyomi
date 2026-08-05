import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { Rss2LineNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import { resolveNativeMotionEffect } from "@kyomi/ui/native/motion";
import { kyomiNativeBrand } from "@kyomi/ui/native/theme";

const uiPackage = JSON.parse(
  readFileSync(resolve(process.cwd(), "../packages/ui/package.json"), "utf8"),
) as {
  exports: Record<string, string>;
};

describe("native UI contracts", () => {
  test("publishes native-safe entrypoints through the package export map", () => {
    expect(uiPackage.exports).toMatchObject({
      "./icons/mingcute-native": "./src/icons/mingcute-native.ts",
      "./native/motion": "./src/native/motion.ts",
      "./native/theme": "./src/native/theme.ts",
    });
  });

  test("exposes only the proven native brand accent", () => {
    expect(kyomiNativeBrand).toEqual({
      matcha: {
        color: "#a8d480",
        onColor: "#17240c",
      },
    });
  });

  test("preserves the upstream Mingcute RSS line geometry", () => {
    expect(Rss2LineNativeIcon).toEqual({
      viewBox: "0 0 24 24",
      paths: [
        {
          d: "M5.5 17a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m0-14C14.06 3 21 9.94 21 18.5q0 .268-.009.534a1 1 0 0 1-1.999-.068Q19 18.734 19 18.5C19 11.044 12.956 5 5.5 5q-.234 0-.466.008a1 1 0 0 1-.068-1.999Q5.231 3 5.5 3m0 7a8.5 8.5 0 0 1 8.482 9.066 1 1 0 0 1-1.996-.132 6.5 6.5 0 0 0-6.92-6.92 1 1 0 1 1-.132-1.995q.28-.02.566-.019",
        },
      ],
    });
  });

  test("keeps visible selection semantics identical while reducing motion", () => {
    const standard = resolveNativeMotionEffect("selection-change", false);
    const reduced = resolveNativeMotionEffect("selection-change", true);

    expect(standard).toEqual({
      effect: "selection-surface-fade",
      selectedSurfaceAlpha: 0.14,
    });
    expect(reduced).toEqual({
      effect: "selection-surface-instant",
      selectedSurfaceAlpha: 0.14,
    });
    expect(standard).not.toHaveProperty("duration");
    expect(standard).not.toHaveProperty("durationMs");
    expect(standard).not.toHaveProperty("damping");
    expect(standard).not.toHaveProperty("stiffness");
  });
});
