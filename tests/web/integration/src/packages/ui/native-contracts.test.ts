import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BookmarkFilledIcon, SearchIcon } from "@kyomi/ui/icons/blode";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  BLODE_STROKE_WIDTH,
  BookmarkFilledNativeIcon,
  SearchNativeIcon,
} from "@kyomi/ui/icons/blode-native";
import { resolveNativeMotionEffect } from "@kyomi/ui/native/motion";
import { kyomiNativeBrand } from "@kyomi/ui/native/theme";

const uiPackage = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../../../../../packages/ui/package.json"), "utf8"),
) as {
  exports: Record<string, string>;
};

describe("native UI contracts", () => {
  test("publishes native-safe entrypoints through the package export map", () => {
    expect(uiPackage.exports).toMatchObject({
      "./icons/blode-native": "./src/icons/blode-native.ts",
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
      mizu: {
        color: "#81c7d4",
        onColor: "#082b33",
      },
    });
  });

  test("mirrors the Blode geometry the native icons draw", () => {
    const pathData = (icon: Parameters<typeof createElement>[0]) =>
      /<path[^>]* d="([^"]*)"/.exec(renderToStaticMarkup(createElement(icon)))?.[1];

    expect(BLODE_STROKE_WIDTH).toBe(2);
    expect(SearchNativeIcon.paths).toEqual([
      { d: pathData(SearchIcon), stroke: { linecap: "round" } },
    ]);
    expect(BookmarkFilledNativeIcon.paths).toEqual([{ d: pathData(BookmarkFilledIcon) }]);
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
