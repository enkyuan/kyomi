import type { ReactNode } from "react";
import { G, Path, Rect } from "react-native-svg";
import { BLODE_STROKE_WIDTH, type BlodeNativeIcon } from "@kyomi/ui/icons/blode-native";

/**
 * The building blocks every empty-state scene is drawn from, taken from the original stacked-paper
 * illustration: one 192-unit canvas inside the dashed circle, a tilted paper with a soft gradient
 * fill and a hairline gradient stroke, skeleton lines in four fading tones, and a small glyph.
 * A scene is only ever assembled from these, so every state reads as the same family.
 */

export type EmptyStateTheme = {
  background: string;
  backgroundOpacity: number;
  border: string;
  borderOpacity: number;
  icon: string;
  iconOpacity: number;
  lines: readonly [string, string, string, string];
  lineOpacities: readonly [number, number, number, number];
  paperOpacity: number;
  /** The paper's hairline edge, from its top corner to its bottom. */
  edge: { from: string; fromOpacity: number; to: string; toOpacity: number };
  /** An opaque surface colour laid under every translucent fill so overlapping shapes never show through. */
  base: string;
  /** Opaque mid tones for shapes drawn as plain strokes (a padlock shackle): fill and its edge. */
  tone: string;
  toneEdge: string;
  /** Opacity of the soft contact shadow under every paper; none in dark, where surfaces glow. */
  shadowOpacity: number;
  isDark: boolean;
};

export function getEmptyStateTheme(isDark: boolean): EmptyStateTheme {
  return isDark
    ? {
        background: "#141414",
        backgroundOpacity: 0.25,
        border: "white",
        borderOpacity: 0.15,
        icon: "white",
        iconOpacity: 0.3,
        lines: ["white", "white", "white", "white"],
        lineOpacities: [0.1, 0.075, 0.05, 0.025],
        paperOpacity: 0.1,
        edge: { from: "white", fromOpacity: 0.1, to: "#323232", toOpacity: 0 },
        shadowOpacity: 0,
        base: "#0F0F0F",
        tone: "#2A2A2A",
        toneEdge: "#3A3A3A",
        isDark,
      }
    : {
        background: "#FAFAFA",
        backgroundOpacity: 1,
        border: "#DBDBDB",
        borderOpacity: 1,
        icon: "#09244B",
        iconOpacity: 1,
        lines: ["#E7E7E7", "#F0F0F0", "#F6F6F6", "#FAFAFA"],
        lineOpacities: [1, 1, 1, 1],
        paperOpacity: 1,
        edge: { from: "#D6D6D6", fromOpacity: 1, to: "#E4E4E4", toOpacity: 1 },
        shadowOpacity: 0.06,
        base: "#FAFAFA",
        tone: "#E8E8E8",
        toneEdge: "#D6D6D6",
        isDark,
      };
}

/** What a scene receives: the theme and the gradient paints defined once by the frame. */
export type SceneContext = {
  theme: EmptyStateTheme;
  /** `url(#…)` paints. `back` fades the paper behind, `fill` is the front paper, `stroke` its edge. */
  paints: { back: string; fill: string; stroke: string };
};

export type Scene = (context: SceneContext) => ReactNode;

/** The paper's own coordinate space: origin at its content corner, tilted 5 degrees. */
export const PAPER_FRAME = "translate(62.4 49.67) rotate(5)";

const BACK_PAPER_PATH =
  "M47.44 56.77C47.07 52.64 50.13 49.01 54.25 48.64L127.97 42.2C132.1 41.83 135.74 44.89 136.1 49.01L143.59 134.69C143.95 138.81 140.9 142.45 136.78 142.81L63.06 149.26C58.93 149.62 55.29 146.57 54.93 142.44L47.44 56.77Z";
const FRONT_PAPER_PATH =
  "M54.43 48.97C54.82 44.57 58.7 41.31 63.1 41.7L136.82 48.15C141.22 48.53 144.47 52.41 144.09 56.81L136.59 142.49C136.21 146.89 132.33 150.14 127.93 149.76L54.21 143.31C49.81 142.92 46.55 139.04 46.94 134.64L54.43 48.97Z";
const FRONT_PAPER_STROKE_PATH =
  "M54.93 49.01C55.29 44.89 58.93 41.83 63.05 42.2L136.77 48.64C140.9 49.01 143.95 52.64 143.59 56.77L136.1 142.44C135.74 146.57 132.1 149.62 127.97 149.26L54.25 142.81C50.13 142.45 47.07 138.81 47.43 134.69L54.93 49.01Z";

type PlacementProps = {
  /** Degrees about the canvas centre, for fanning stacked papers. */
  tilt?: number;
  x?: number;
  y?: number;
};

function place({ tilt = 0, x = 0, y = 0 }: PlacementProps) {
  return `translate(${x} ${y}) rotate(${tilt} 96 96)`;
}

/** A soft contact shadow, a hair below the shape, so a pale paper still lifts off a pale circle. */
function Shadow({ context, d }: { context: SceneContext; d: string }) {
  if (context.theme.shadowOpacity === 0) {
    return null;
  }
  return (
    <Path
      d={d}
      fill="black"
      fillOpacity={context.theme.shadowOpacity}
      transform="translate(0 1.5)"
    />
  );
}

/** A paper resting behind the main one: the gradient fill and edge at half strength. */
export function BackPaper({ context, ...placement }: { context: SceneContext } & PlacementProps) {
  return (
    <G opacity={0.5} transform={place(placement)}>
      <Shadow context={context} d={BACK_PAPER_PATH} />
      <Path d={BACK_PAPER_PATH} fill={context.paints.back} />
      <Path d={BACK_PAPER_PATH} stroke={context.paints.stroke} strokeLinecap="round" />
    </G>
  );
}

/** The main paper: fill, then `children` (drawn in canvas space), then the hairline edge on top. */
export function Paper({
  children,
  context,
  ...placement
}: { children?: ReactNode; context: SceneContext } & PlacementProps) {
  return (
    <G transform={place(placement)}>
      <Shadow context={context} d={FRONT_PAPER_PATH} />
      <Path d={FRONT_PAPER_PATH} fill={context.paints.fill} />
      {children}
      <Path d={FRONT_PAPER_STROKE_PATH} stroke={context.paints.stroke} strokeLinecap="round" />
    </G>
  );
}

/** A silhouette other than the paper (folder, shield, bell…) given the same fill and edge. */
export function Surface({
  children,
  context,
  d,
  strokeD,
  ...placement
}: {
  children?: ReactNode;
  context: SceneContext;
  d: string;
  /** Edge path inset half a unit from `d`; defaults to `d` itself. */
  strokeD?: string;
} & PlacementProps) {
  return (
    <G transform={place(placement)}>
      <Shadow context={context} d={d} />
      <Path d={d} fill={context.theme.base} />
      <Path d={d} fill={context.paints.fill} />
      {children}
      <Path d={strokeD ?? d} fill="none" stroke={context.paints.stroke} strokeLinecap="round" />
    </G>
  );
}

/** The paper's skeleton lines, tone 0 (darkest) to 3 (faintest), as in the original. */
const LINE_WIDTHS = [57.3, 73.7, 65.5, 45.3] as const;
const LINE_PITCH = 15.44;

export function PaperLines({
  context,
  count = 4,
  first = 0,
  top = 32,
  widths = LINE_WIDTHS,
}: {
  context: SceneContext;
  /** How many of the four lines to draw. */
  count?: number;
  /** Index of the first line, to keep the tones when drawing a later subset. */
  first?: number;
  /** Local y of the first drawn line. */
  top?: number;
  widths?: readonly number[];
}) {
  const { theme } = context;
  return (
    <G transform={PAPER_FRAME}>
      {Array.from({ length: count }, (_, index) => {
        const tone = Math.min(3, first + index);
        return (
          <Rect
            fill={theme.lines[tone]}
            fillOpacity={theme.lineOpacities[tone]}
            height={7.5}
            key={index}
            rx={3.75}
            width={widths[first + index] ?? widths[widths.length - 1]}
            x={0}
            y={top + index * LINE_PITCH}
          />
        );
      })}
    </G>
  );
}

/** A rounded bar in one of the four line tones, for tags, rows and placeholders. */
export function Bar({
  context,
  height = 7.5,
  tone = 0,
  width,
  x,
  y,
}: {
  context: SceneContext;
  height?: number;
  tone?: 0 | 1 | 2 | 3;
  width: number;
  x: number;
  y: number;
}) {
  const { theme } = context;
  return (
    <Rect
      fill={theme.lines[tone]}
      fillOpacity={theme.lineOpacities[tone]}
      height={height}
      rx={height / 2}
      width={width}
      x={x}
      y={y}
    />
  );
}

/** A Blode glyph in the theme's icon colour at `size` units, positioned by its top-left corner. */
export function Glyph({
  context,
  icon,
  size = 16,
  x = 0,
  y = 0,
}: {
  context: SceneContext;
  icon: BlodeNativeIcon;
  size?: number;
  x?: number;
  y?: number;
}) {
  const { theme } = context;
  return (
    <G opacity={theme.iconOpacity} transform={`translate(${x} ${y}) scale(${size / 24})`}>
      {icon.paths.map((path) =>
        path.stroke ? (
          <Path
            d={path.d}
            fill="none"
            key={path.d}
            stroke={theme.icon}
            strokeLinecap={path.stroke.linecap}
            strokeLinejoin={path.stroke.linejoin}
            strokeWidth={BLODE_STROKE_WIDTH}
          />
        ) : (
          <Path d={path.d} fill={theme.icon} fillRule={path.fillRule} key={path.d} />
        ),
      )}
    </G>
  );
}

/**
 * The one checkmark every state uses, drawn on a 24-unit grid with a 2-unit round stroke and placed
 * by its top-left corner at `size` units, so it matches the Blode check everywhere else.
 */
export function Check({
  context,
  size = 24,
  x = 0,
  y = 0,
}: {
  context: SceneContext;
  size?: number;
  x?: number;
  y?: number;
}) {
  const { theme } = context;
  return (
    <G opacity={theme.iconOpacity} transform={`translate(${x} ${y}) scale(${size / 24})`}>
      <Path
        d="M5 12.75 10 19l9-14"
        fill="none"
        stroke={theme.icon}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </G>
  );
}
