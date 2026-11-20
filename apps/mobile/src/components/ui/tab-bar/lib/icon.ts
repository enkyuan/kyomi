import { BLODE_STROKE_WIDTH, type BlodeNativeIcon } from "@kyomi/ui/icons/blode-native";
import type { TabBarIcon } from "../../../../../modules/tab-bar";

/** Maps Blode geometry to the native bar: line glyphs carry their stroke width, filled ones none. */
export function toTabBarIcon(icon: BlodeNativeIcon, rotation?: number): TabBarIcon {
  return {
    viewBox: icon.viewBox,
    rotation,
    paths: icon.paths.map((path) => ({
      d: path.d,
      fillRule: path.fillRule,
      strokeWidth: path.stroke ? BLODE_STROKE_WIDTH : undefined,
    })),
  };
}
