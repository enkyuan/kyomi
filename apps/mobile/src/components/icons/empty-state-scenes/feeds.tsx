import { Circle, G, Path, Rect } from "react-native-svg";
import { RssNativeIcon } from "@kyomi/ui/icons/blode-native";
import {
  BackPaper,
  Bar,
  Glyph,
  PAPER_FRAME,
  Paper,
  PaperLines,
  type Scene,
  type SceneContext,
  Surface,
} from "./parts";

/** The original illustration: a paper stacked on another, an RSS badge and four skeleton lines. */
const myFeed: Scene = (context) => (
  <>
    <BackPaper context={context} />
    <Paper context={context}>
      <G transform={PAPER_FRAME}>
        <Glyph context={context} icon={RssNativeIcon} size={16} />
      </G>
      <PaperLines context={context} />
    </Paper>
  </>
);

function rrect(x: number, y: number, w: number, h: number, r: number) {
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

function circle(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
}

/** The dashed "ghost" outline of the thing that will land here. */
function Ghost({
  context,
  d,
  transform,
}: {
  context: SceneContext;
  d: string;
  transform?: string;
}) {
  const { theme } = context;
  return (
    <Path
      d={d}
      fill="none"
      stroke={theme.border}
      strokeDasharray="4 5"
      strokeLinecap="round"
      strokeOpacity={theme.borderOpacity}
      strokeWidth={1.5}
      transform={transform}
    />
  );
}

function Accent({ children, context }: { children: React.ReactNode; context: SceneContext }) {
  const { theme } = context;
  return (
    <G
      fill="none"
      opacity={theme.iconOpacity}
      stroke={theme.icon}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={3}
    >
      {children}
    </G>
  );
}

/** A tile's placeholder content: an avatar dot and a short bar. */
function TileContent({
  context,
  h,
  w,
  x,
  y,
}: {
  context: SceneContext;
  h: number;
  w: number;
  x: number;
  y: number;
}) {
  const { theme } = context;
  const r = Math.min(w, h) / 2 - 11;
  return (
    <>
      <Circle
        cx={x + w / 2}
        cy={y + h / 2 - 4}
        fill={theme.lines[0]}
        fillOpacity={theme.lineOpacities[0]}
        r={Math.max(r - 2, 6)}
      />
      <Bar context={context} tone={1} width={w - 24} x={x + 12} y={y + h - 15} />
    </>
  );
}

/** A bento mosaic of four source tiles of different sizes, the biggest carrying the RSS accent. */
const allFeeds: Scene = (context) => (
  <>
    <Surface context={context} d={rrect(38, 40, 64, 64, 17)}>
      <Glyph context={context} icon={RssNativeIcon} size={30} x={55} y={57} />
    </Surface>
    <Surface context={context} d={rrect(110, 40, 44, 44, 14)}>
      <TileContent context={context} h={44} w={44} x={110} y={40} />
    </Surface>
    <Surface context={context} d={rrect(38, 112, 64, 40, 14)}>
      <TileContent context={context} h={40} w={64} x={38} y={112} />
    </Surface>
    <Surface context={context} d={rrect(110, 92, 44, 60, 14)}>
      <TileContent context={context} h={60} w={44} x={110} y={92} />
    </Surface>
  </>
);

/** A soft concentric wash behind one big upright check tile: done, nothing more to show. */
const unreadCaughtUp: Scene = (context) => {
  const { theme } = context;
  return (
    <>
      <Circle cx={96} cy={96} fill={theme.lines[2]} fillOpacity={theme.lineOpacities[2]} r={62} />
      <Circle cx={96} cy={96} fill={theme.lines[1]} fillOpacity={theme.lineOpacities[1]} r={50} />
      <G transform="rotate(-8 96 96)">
        <Surface context={context} d={rrect(62, 62, 68, 68, 22)} />
        <G transform="translate(62 62)">
          <Accent context={context}>
            <Path d="M20 35 L30 45 L49 23" />
          </Accent>
        </G>
      </G>
    </>
  );
};

const BOOKMARK =
  "M72 48H120V128C120 131 116.800 132.800 114.200 131 L96 118 L77.800 131C75.200 132.800 72 131 72 128Z";

/** One upright bookmark ribbon with a dashed ghost card waiting behind it. */
const saved: Scene = (context) => {
  return (
    <G transform="translate(-13 2)">
      <Ghost context={context} d={rrect(112, 50, 46, 80, 15)} transform="rotate(9 135 90)" />
      <Surface context={context} d={BOOKMARK} />
      <G transform="translate(96 82)">
        <Accent context={context}>
          <Path d="M-11 0 L-3 8 L12 -9" />
        </Accent>
      </G>
    </G>
  );
};

/** A clock on a shelf, with a dashed ghost card waiting beside it. */
const readLater: Scene = (context) => (
  <>
    <Surface context={context} d={rrect(36, 128, 120, 16, 8)} />
    <Ghost context={context} d={rrect(114, 62, 34, 58, 12)} transform="rotate(9 131 120)" />
    <Surface context={context} d={circle(76, 88, 38)}>
      <G transform="translate(76 88)">
        <Accent context={context}>
          <Path d="M0 -18V0L12 7" />
        </Accent>
      </G>
    </Surface>
  </>
);

export const FEED_SCENES = {
  "my-feed": myFeed,
  "all-feeds": allFeeds,
  "unread-caught-up": unreadCaughtUp,
  saved,
  "read-later": readLater,
} as const;
