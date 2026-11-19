import { G, Path, Rect, Circle } from "react-native-svg";
import { RssNativeIcon } from "@kyomi/ui/icons/blode-native";
import {
  BackPaper,
  Glyph,
  PAPER_FRAME,
  Paper,
  PaperLines,
  type Scene,
  type SceneContext,
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

/** Small hand-drawn badge strokes share the theme icon colour. */
function Badge({ children, context }: { children: React.ReactNode; context: SceneContext }) {
  const { theme } = context;
  return (
    <G opacity={theme.iconOpacity} transform={PAPER_FRAME}>
      <G
        fill="none"
        stroke={theme.icon}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      >
        {children}
      </G>
    </G>
  );
}

/** A fanned stack of three papers with a small 2x2 grid badge: everything you follow. */
const allFeeds: Scene = (context) => {
  const { theme } = context;
  return (
    <>
      <BackPaper context={context} tilt={-15} x={-10} y={0} />
      <BackPaper context={context} tilt={15} x={10} y={0} />
      <Paper context={context} y={2}>
        <G opacity={theme.iconOpacity} transform={PAPER_FRAME}>
          <G fill={theme.icon}>
            <Rect height={6.5} rx={2.2} width={6.5} x={1} y={1} />
            <Rect height={6.5} rx={2.2} width={6.5} x={10.5} y={1} />
            <Rect height={6.5} rx={2.2} width={6.5} x={1} y={10.5} />
            <Rect height={6.5} rx={2.2} width={6.5} x={10.5} y={10.5} />
          </G>
        </G>
        <PaperLines context={context} top={32} widths={[57.3, 73.7, 65.5, 45.3]} />
      </Paper>
    </>
  );
};

/** A paper with a check in a ring and only a few faded lines: nothing left to read. */
const unreadCaughtUp: Scene = (context) => (
  <>
    <BackPaper context={context} />
    <Paper context={context}>
      <Badge context={context}>
        <Circle cx={9} cy={9} r={8.5} />
        <Path d="M5.2 9.3 L8 12 L13 6.4" />
      </Badge>
      <PaperLines context={context} count={3} first={1} widths={[0, 57.3, 73.7, 45.3]} />
    </Paper>
  </>
);

/** A paper with a bookmark ribbon hanging from its top edge. */
const saved: Scene = (context) => (
  <>
    <BackPaper context={context} />
    <Paper context={context}>
      <PaperLines context={context} top={34} />
      <G transform={PAPER_FRAME}>
        <Path
          d="M61 -6.5 H77 V19 C77 20.4 75.6 21.2 74.5 20.3 L69 15.8 L63.5 20.3 C62.4 21.2 61 20.4 61 19 Z"
          fill={context.theme.icon}
          fillOpacity={context.theme.iconOpacity}
          stroke={context.theme.icon}
          strokeLinejoin="round"
          strokeOpacity={context.theme.iconOpacity}
          strokeWidth={2}
        />
      </G>
    </Paper>
  </>
);

/** A paper with a clock badge: set aside for later. */
const readLater: Scene = (context) => (
  <>
    <BackPaper context={context} />
    <Paper context={context}>
      <Badge context={context}>
        <Circle cx={9} cy={9} r={8.5} />
        <Path d="M9 4.6 V9 L12 10.8" />
      </Badge>
      <PaperLines context={context} />
    </Paper>
  </>
);

export const FEED_SCENES = {
  "my-feed": myFeed,
  "all-feeds": allFeeds,
  "unread-caught-up": unreadCaughtUp,
  saved,
  "read-later": readLater,
} as const;
