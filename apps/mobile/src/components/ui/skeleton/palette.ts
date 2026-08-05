export type HexColor = `#${string}`;

export type SkeletonColorMode = "dark" | "light";

type RgbColor = readonly [number, number, number];

const SKELETON_LAYERS = {
  dark: {
    base: { color: "#ffffff", opacity: 0.04 },
    highlight: { color: "#ffffff", opacity: 0.04 },
  },
  light: {
    base: { color: "#000000", opacity: 0.04 },
    highlight: { color: "#ffffff", opacity: 0.64 },
  },
} as const satisfies Record<
  SkeletonColorMode,
  Record<"base" | "highlight", { color: HexColor; opacity: number }>
>;

function fromHex(color: HexColor): RgbColor {
  const value = color.slice(1);

  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function toHex([red, green, blue]: RgbColor): HexColor {
  return `#${[red, green, blue]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function layer([red, green, blue]: RgbColor, color: HexColor, opacity: number): RgbColor {
  const [overlayRed, overlayGreen, overlayBlue] = fromHex(color);
  const baseOpacity = 1 - opacity;

  return [
    red * baseOpacity + overlayRed * opacity,
    green * baseOpacity + overlayGreen * opacity,
    blue * baseOpacity + overlayBlue * opacity,
  ];
}

/**
 * Mirrors the shared web skeleton: a muted surface layer plus a translucent
 * highlight layer composited over that surface.
 */
export function getSkeletonPalette(colorMode: SkeletonColorMode, surfaceColor: HexColor) {
  const layers = SKELETON_LAYERS[colorMode];
  const base = layer(fromHex(surfaceColor), layers.base.color, layers.base.opacity);
  const backgroundColor = toHex(base);
  const highlight = toHex(layer(base, layers.highlight.color, layers.highlight.opacity));

  return {
    backgroundColor,
    colors: [backgroundColor, backgroundColor, highlight, backgroundColor, backgroundColor],
  };
}
