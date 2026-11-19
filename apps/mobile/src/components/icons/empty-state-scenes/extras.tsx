import type { ReactNode } from "react";
import { useId } from "react";
import { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { BLODE_STROKE_WIDTH } from "@kyomi/ui/icons/blode-native";
import { Bar, Surface, type Scene, type SceneContext } from "./parts";

/**
 * A small hand-drawn glyph on a 24-unit grid, scaled to `size` and positioned by its top-left
 * corner, in the theme's icon colour. This is the one accent in a scene.
 */
function Badge({
  children,
  context,
  size = 16,
  x,
  y,
}: {
  children: ReactNode;
  context: SceneContext;
  size?: number;
  x: number;
  y: number;
}) {
  const { theme } = context;
  return (
    <G
      fill="none"
      opacity={theme.iconOpacity}
      stroke={theme.icon}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={BLODE_STROKE_WIDTH}
      transform={`translate(${x} ${y}) scale(${size / 24})`}
    >
      {children}
    </G>
  );
}

type Point = readonly [number, number];

const round = (value: number) => Math.round(value * 100) / 100;

/** A rounded rectangle path; `inset` shrinks it for the hairline edge. */
function rr(x: number, y: number, w: number, h: number, r: number, inset = 0) {
  const left = x + inset;
  const top = y + inset;
  const width = w - inset * 2;
  const height = h - inset * 2;
  const radius = Math.max(0, r - inset);
  return `M${left + radius} ${top}H${left + width - radius}A${radius} ${radius} 0 0 1 ${left + width} ${top + radius}V${top + height - radius}A${radius} ${radius} 0 0 1 ${left + width - radius} ${top + height}H${left + radius}A${radius} ${radius} 0 0 1 ${left} ${top + height - radius}V${top + radius}A${radius} ${radius} 0 0 1 ${left + radius} ${top}Z`;
}

/** A closed polygon with every corner rounded by up to `r` units. */
function roundedPoly(points: readonly Point[], r: number) {
  const count = points.length;
  let d = "";
  points.forEach((current, index) => {
    const prev = points[(index - 1 + count) % count]!;
    const next = points[(index + 1) % count]!;
    const toPrev = [prev[0] - current[0], prev[1] - current[1]] as const;
    const toNext = [next[0] - current[0], next[1] - current[1]] as const;
    const lenPrev = Math.hypot(...toPrev);
    const lenNext = Math.hypot(...toNext);
    const reach = Math.min(r, lenPrev / 2, lenNext / 2);
    const a = [
      current[0] + (toPrev[0] / lenPrev) * reach,
      current[1] + (toPrev[1] / lenPrev) * reach,
    ] as const;
    const b = [
      current[0] + (toNext[0] / lenNext) * reach,
      current[1] + (toNext[1] / lenNext) * reach,
    ] as const;
    d += `${index === 0 ? "M" : "L"}${round(a[0])} ${round(a[1])}Q${current[0]} ${current[1]} ${round(b[0])} ${round(b[1])}`;
  });
  return `${d}Z`;
}

/** Muted keywords: three staggered pill chips, the middle one struck through. */
const mutedKeywords: Scene = (context) => {
  const { theme } = context;
  const chip = (x: number, y: number, w: number) => ({
    d: rr(x, y, w, 26, 13),
    strokeD: rr(x, y, w, 26, 13, 0.5),
  });
  return (
    <G>
      <Surface context={context} tilt={-3} {...chip(44, 50, 76)}>
        <Circle cx={58} cy={62} fill={theme.lines[0]} fillOpacity={theme.lineOpacities[0]} r={4} />
        <Bar context={context} tone={1} width={38} x={68} y={58.25} />
      </Surface>
      <Surface context={context} {...chip(64, 84, 84)}>
        <Circle cx={78} cy={96} fill={theme.lines[0]} fillOpacity={theme.lineOpacities[0]} r={4} />
        <Bar context={context} tone={0} width={44} x={88} y={92.25} />
        <Path
          d="M58 96H154"
          opacity={theme.iconOpacity}
          stroke={theme.icon}
          strokeLinecap="round"
          strokeWidth={2.5}
        />
      </Surface>
      <Surface context={context} tilt={3} {...chip(48, 118, 62)}>
        <Circle cx={62} cy={130} fill={theme.lines[1]} fillOpacity={theme.lineOpacities[1]} r={4} />
        <Bar context={context} tone={2} width={26} x={72} y={126.25} />
      </Surface>
    </G>
  );
};

/** Reader highlights: a highlighter lying diagonally over faint, dashed, still-empty text lines. */
const readerNoHighlights: Scene = (context) => {
  const { theme } = context;
  const ghost = (x: number, y: number, w: number) => (
    <Rect
      fill="none"
      height={14}
      rx={7}
      stroke={theme.border}
      strokeDasharray="3 3"
      strokeOpacity={theme.borderOpacity}
      strokeWidth={1}
      width={w}
      x={x}
      y={y}
    />
  );
  return (
    <G>
      {ghost(40, 114, 112)}
      {ghost(40, 136, 70)}
      <Surface
        context={context}
        d="M84 38H108C111 38 112 39 112 42V108L104 130H88L80 108V42C80 39 81 38 84 38Z"
        tilt={42}
        x={0}
        y={-6}
      >
        <Rect
          fill={theme.icon}
          fillOpacity={0.12 * theme.iconOpacity}
          height={16}
          width={32}
          x={80}
          y={54}
        />
        <Path
          d="M80 54H112"
          opacity={theme.iconOpacity}
          stroke={theme.icon}
          strokeLinecap="round"
          strokeWidth={2.5}
        />
      </Surface>
    </G>
  );
};

/** Advanced, no data: a big open box seen in perspective with nothing in it. */
/**
 * Two external drives drawn in the reference's own 678x452 pixel space and scaled into the circle:
 * a port drive (capsule slot and three round ports) and a plain drive with a thick bottom lip. The
 * metal is a local palette (silver in light, graphite in dark); the centre is left blank.
 */
function StorageDrives({ context }: { context: SceneContext }) {
  const id = useId().replaceAll(":", "");
  const dark = context.theme.isDark;
  const c = dark
    ? {
        faceTop: "#3D3D3D",
        faceBottom: "#2A2A2A",
        bevelLight: "#454545",
        bevelDark: "#1E1E1E",
        lipTop: "#383838",
        lipBottom: "#232323",
        lineLight: "#5A5A5A",
        lineDark: "#161616",
        port: "#050505",
        rim: "#575757",
        accent: context.theme.icon,
      }
    : {
        faceTop: "#DCDCDC",
        faceBottom: "#C4C4C4",
        bevelLight: "#D6D6D6",
        bevelDark: "#A8A8A8",
        lipTop: "#D3D3D3",
        lipBottom: "#B4B4B4",
        lineLight: "#F2F2F2",
        lineDark: "#A0A0A0",
        port: "#0A0A0A",
        rim: "#EDEDED",
        accent: context.theme.icon,
      };
  const face = `drive-face-${id}`;
  const bevel = `drive-bevel-${id}`;
  const lip = `drive-lip-${id}`;
  const leftBody =
    "M49 66H283C298 66 308 78 308 94V366C308 382 298 395 283 395H61C46 395 37 386 37 372V80C37 72 42 66 49 66Z";
  const rightBody =
    "M374 92C374 76 388 66 408 66H606C626 66 640 76 640 92V370C640 386 630 395 616 395H394C382 395 374 390 374 380Z";
  return (
    <G transform="translate(34 62) scale(0.205) translate(-37 -66)">
      <Defs>
        <LinearGradient gradientUnits="userSpaceOnUse" id={face} x1="0" x2="0" y1="66" y2="395">
          <Stop offset="0" stopColor={c.faceTop} />
          <Stop offset="1" stopColor={c.faceBottom} />
        </LinearGradient>
        <LinearGradient gradientUnits="objectBoundingBox" id={bevel} x1="0" x2="1" y1="0" y2="0">
          <Stop offset="0" stopColor={c.bevelLight} />
          <Stop offset="1" stopColor={c.bevelDark} />
        </LinearGradient>
        <LinearGradient gradientUnits="userSpaceOnUse" id={lip} x1="0" x2="0" y1="352" y2="395">
          <Stop offset="0" stopColor={c.lipTop} />
          <Stop offset="1" stopColor={c.lipBottom} />
        </LinearGradient>
      </Defs>

      <Path d={leftBody} fill={`url(#${face})`} />
      <Path d="M283 66C298 66 308 78 308 94V366C308 382 298 395 283 395Z" fill={`url(#${bevel})`} />
      <Path
        d="M284 70V391"
        fill="none"
        stroke={c.lineLight}
        strokeLinecap="round"
        strokeWidth={2}
      />
      <Path
        d="M38 84V366"
        fill="none"
        stroke={c.lineLight}
        strokeLinecap="round"
        strokeOpacity={0.7}
        strokeWidth={2}
      />
      <Rect fill={c.rim} height={19} rx={9.5} width={76} x={48} y={366} />
      <Rect fill={c.port} height={15} rx={7.5} width={72} x={50} y={368} />
      {[229, 254, 278].map((cx, index) => (
        <G key={cx}>
          <Circle cx={cx} cy={375.5} fill={c.rim} r={11} />
          <Circle cx={cx} cy={375.5} fill={index === 2 ? c.accent : c.port} r={9} />
        </G>
      ))}

      <Path d={rightBody} fill={`url(#${face})`} />
      <Path
        d="M374 92C374 76 388 66 408 66H606C626 66 640 76 640 92C640 98 630 101 620 101H394C384 101 374 98 374 92Z"
        fill={c.lineLight}
        fillOpacity={dark ? 0.16 : 0.85}
      />
      <Path
        d="M376 98C384 101 394 101 396 101H618C626 101 636 100 638 98"
        fill="none"
        stroke={c.lineDark}
        strokeOpacity={0.35}
        strokeWidth={1.6}
      />
      <Path d="M612 70C630 70 640 80 640 94V370C640 386 630 395 612 395Z" fill={`url(#${bevel})`} />
      <Path
        d="M374 352H640V370C640 386 630 395 616 395H394C382 395 374 390 374 380Z"
        fill={`url(#${lip})`}
      />
      <Path d="M374 352H640" fill="none" stroke={c.lineDark} strokeWidth={2} />
      <Path d="M374 349H640" fill="none" stroke={c.lineLight} strokeOpacity={0.8} strokeWidth={2} />
    </G>
  );
}

const advancedNoData: Scene = (context) => <StorageDrives context={context} />;

/** Feedback sent: one paper plane flies off its envelope along the dashed trail, nose pointing the way it travels. */
const feedbackSent: Scene = (context) => {
  const { theme } = context;
  const plane: readonly Point[] = [
    [152, 44],
    [108, 76],
    [126, 86],
    [122, 110],
  ];
  return (
    <G transform="translate(0 6)">
      <Surface
        context={context}
        d={rr(34, 104, 56, 40, 10)}
        strokeD={rr(36, 104, 58, 42, 10, 0.5)}
        tilt={-4}
      >
        <Path
          d="M40 111L62 128C64 129.5 66 129.5 68 128L90 111"
          fill="none"
          opacity={theme.detailOpacity}
          stroke={theme.detail}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.4}
        />
      </Surface>
      <Path
        d="M82 104C96 124 120 120 130 98"
        fill="none"
        opacity={theme.iconOpacity}
        stroke={theme.icon}
        strokeDasharray="2 5"
        strokeLinecap="round"
        strokeWidth={2.5}
      />
      <Surface context={context} d={roundedPoly(plane, 4)} x={8} y={-8}>
        <Path
          d="M152 44L126 86"
          fill="none"
          opacity={theme.detailOpacity}
          stroke={theme.detail}
          strokeLinecap="round"
          strokeWidth={1.4}
        />
      </Surface>
    </G>
  );
};

/** Offline: a big cloud with a dashed twin behind it, cut by a single slash. */
const offline: Scene = (context) => {
  const { theme } = context;
  const cloud =
    "M72 132C57 132 46 121 46 107C46 95 54 86 65 84C68 70 80 60 95 60C109 60 120 69 123 82C137 83 148 93 148 107C148 121 137 132 124 132Z";
  return (
    <G transform="translate(-6 5)">
      <Path
        d={cloud}
        fill="none"
        stroke={theme.border}
        strokeDasharray="3 4"
        strokeLinecap="round"
        strokeOpacity={theme.borderOpacity}
        transform="translate(11 -14)"
      />
      <Surface context={context} d={cloud} x={0} y={6} />
      <Path
        d="M76 134L122 82"
        opacity={theme.iconOpacity}
        stroke={theme.icon}
        strokeLinecap="round"
        strokeWidth={3}
      />
    </G>
  );
};

/** Load error: one card torn in two along a zig-zag, its halves drawn apart, with a warning mark. */
const loadError: Scene = (context) => {
  const left: readonly Point[] = [
    [50, 44],
    [96, 44],
    [104, 66],
    [90, 84],
    [102, 104],
    [88, 124],
    [96, 148],
    [50, 148],
  ];
  const right: readonly Point[] = [
    [96, 44],
    [142, 44],
    [142, 148],
    [96, 148],
    [88, 124],
    [102, 104],
    [90, 84],
    [104, 66],
  ];
  return (
    <G>
      <Surface context={context} d={roundedPoly(left, 7)} tilt={-4} x={-4}>
        <Bar context={context} tone={1} width={22} x={60} y={58} />
        <Bar context={context} tone={2} width={16} x={60} y={72} />
      </Surface>
      <Surface context={context} d={roundedPoly(right, 7)} tilt={4} x={4}>
        <Badge context={context} size={22} x={108} y={92}>
          <Path d="M12 3.5L21.5 19.5H2.5Z" />
          <Path d="M12 10V14" />
          <Path d="M12 16.6V16.7" />
        </Badge>
      </Surface>
    </G>
  );
};

/** Permission denied: one padlock, its keyhole cut clean through the body so lock and keyhole are one shape. */
const permissionDenied: Scene = (context) => {
  const { theme } = context;
  const shackle = "M76 92V76C76 64 84 56 96 56S116 64 116 76V92";
  const keyhole =
    "M96 103A6.5 6.5 0 0 1 99.4 115.04L101 126Q101 129 98 129H94Q91 129 91 126L92.6 115.04A6.5 6.5 0 0 1 96 103Z";
  return (
    <G transform="translate(0 -1)">
      <Path
        d={shackle}
        fill="none"
        stroke={theme.toneEdge}
        strokeLinecap="round"
        strokeWidth={13}
      />
      <Path d={shackle} fill="none" stroke={theme.tone} strokeLinecap="round" strokeWidth={10} />
      <Surface
        context={context}
        d={`${rr(62, 88, 68, 54, 15)}${keyhole}`}
        fillRule="evenodd"
        strokeD={rr(62, 88, 68, 54, 15, 0.5)}
      />
    </G>
  );
};

export const EXTRA_SCENES = {
  "settings-muted-keywords": mutedKeywords,
  "settings-reader-no-highlights": readerNoHighlights,
  "settings-advanced-no-data": advancedNoData,
  "settings-feedback-sent": feedbackSent,
  offline,
  "load-error": loadError,
  "permission-denied": permissionDenied,
} as const;
