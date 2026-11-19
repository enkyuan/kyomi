import type { ReactNode } from "react";
import { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import { BLODE_STROKE_WIDTH } from "@kyomi/ui/icons/blode-native";
import {
  Bar,
  PAPER_FRAME,
  Paper,
  PaperLines,
  Surface,
  type Scene,
  type SceneContext,
} from "./parts";

/**
 * A small hand-drawn badge on a 24-unit grid, scaled to `size` and positioned by its top-left
 * corner, in the theme's icon colour. Stands in for the original RSS badge.
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

/** Muted keywords: a paper of pill tags, one of them struck through, a mute badge in the corner. */
const mutedKeywords: Scene = (context) => {
  const { theme } = context;
  return (
    <Paper context={context}>
      <G transform={PAPER_FRAME}>
        <Badge context={context} size={16} x={0} y={0}>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M5.6 5.6L18.4 18.4" />
        </Badge>
        <Bar context={context} height={13} tone={0} width={34} x={0} y={30} />
        <Bar context={context} height={13} tone={1} width={26} x={40} y={30} />
        <Bar context={context} height={13} tone={1} width={42} x={0} y={50} />
        <Bar context={context} height={13} tone={2} width={20} x={48} y={50} />
        <Bar context={context} height={13} tone={2} width={28} x={0} y={70} />
        <Bar context={context} height={13} tone={3} width={34} x={34} y={70} />
        <Path
          d="M-3 56.5H45"
          opacity={theme.iconOpacity}
          stroke={theme.icon}
          strokeLinecap="round"
          strokeWidth={1.75}
        />
      </G>
    </Paper>
  );
};

/** Reader highlights: skeleton text with an empty, dashed highlighter bar behind the second line. */
const readerNoHighlights: Scene = (context) => {
  const { theme } = context;
  return (
    <Paper context={context}>
      <G transform={PAPER_FRAME}>
        <Badge context={context} size={16} x={0} y={0}>
          <Path d="M4 20L5 15.5L16 4.5A2.1 2.1 0 0 1 19.5 8L8.5 19Z" />
          <Path d="M14 7L17 10" />
        </Badge>
        <Rect
          fill="none"
          height={15}
          rx={7.5}
          stroke={theme.border}
          strokeDasharray="3 3"
          strokeOpacity={theme.borderOpacity}
          strokeWidth={1}
          width={70}
          x={-4}
          y={44.7}
        />
      </G>
      <PaperLines context={context} />
    </Paper>
  );
};

/** Advanced, no data: an empty inbox tray with a lone blank sheet resting above it. */
const advancedNoData: Scene = (context) => (
  <>
    <Surface
      context={context}
      d="M70 46H122C126.4 46 130 49.6 130 54V110H62V54C62 49.6 65.6 46 70 46Z"
      tilt={-5}
    >
      <Bar context={context} tone={1} width={36} x={74} y={62} />
      <Bar context={context} tone={2} width={26} x={74} y={76} />
    </Surface>
    <Surface
      context={context}
      d="M44 106C44 100.5 48.5 96 54 96H72C76 96 78.5 98.5 80.5 102C82.5 105.5 85 108 89 108H103C107 108 109.5 105.5 111.5 102C113.5 98.5 116 96 120 96H138C143.5 96 148 100.5 148 106V138C148 144 143 149 137 149H55C49 149 44 144 44 138Z"
      tilt={3}
    >
      <Badge context={context} size={18} x={56} y={116}>
        <Ellipse cx={12} cy={6} rx={8} ry={3} />
        <Path d="M4 6V18C4 19.7 7.6 21 12 21S20 19.7 20 18V6" />
        <Path d="M4 12C4 13.7 7.6 15 12 15S20 13.7 20 12" />
      </Badge>
      <Bar context={context} tone={0} width={34} x={84} y={119} />
      <Bar context={context} tone={2} width={22} x={84} y={131} />
    </Surface>
  </>
);

/** Feedback sent: a note slipping out of an envelope, a check badge on the envelope. */
const feedbackSent: Scene = (context) => (
  <>
    <Surface
      context={context}
      d="M62 46H126C131.5 46 136 50.5 136 56V92H52V56C52 50.5 56.5 46 62 46Z"
      tilt={-4}
    >
      <Bar context={context} tone={0} width={44} x={64} y={58} />
      <Bar context={context} tone={1} width={30} x={64} y={72} />
    </Surface>
    <Surface
      context={context}
      d="M44 82C44 76.5 48.5 72 54 72H138C143.5 72 148 76.5 148 82V134C148 140 143 145 137 145H55C49 145 44 140 44 134Z"
      strokeD="M44.5 82C44.5 76.8 48.8 72.5 54 72.5H138C143.2 72.5 147.5 76.8 147.5 82V134C147.5 139.7 142.7 144.5 137 144.5H55C49.3 144.5 44.5 139.7 44.5 134Z"
      tilt={3}
    >
      <Path
        d="M47 80L91 112C94 114 98 114 101 112L145 80"
        fill="none"
        stroke={context.paints.stroke}
        strokeLinecap="round"
      />
      <Badge context={context} size={18} x={87} y={118}>
        <Path d="M5 12.5L9.5 17L19 7.5" />
      </Badge>
    </Surface>
  </>
);

/** Offline: a soft cloud with two skeleton lines and a struck-through wifi badge. */
const offline: Scene = (context) => (
  <Surface
    context={context}
    d="M72 132C57 132 46 121 46 107C46 95 54 86 65 84C68 70 80 60 95 60C109 60 120 69 123 82C137 83 148 93 148 107C148 121 137 132 124 132Z"
    tilt={4}
  >
    <Badge context={context} size={20} x={85} y={84}>
      <Path d="M2 8.8C7.2 4.2 16.8 4.2 22 8.8" />
      <Path d="M5.2 12.6C9 9.2 15 9.2 18.8 12.6" />
      <Path d="M8.6 16.3C10.6 14.7 13.4 14.7 15.4 16.3" />
      <Circle cx={12} cy={19.5} r={0.6} />
      <Path d="M4 3.5L20 21" />
    </Badge>
    <Bar context={context} tone={0} width={50} x={71} y={111} />
    <Bar context={context} tone={2} width={32} x={80} y={122} height={6} />
  </Surface>
);

/** Load error: a paper with a torn, wavy bottom edge and a warning badge. */
const loadError: Scene = (context) => (
  <Surface
    context={context}
    d="M60 42H128C133.5 42 138 46.5 138 52V138Q133.5 148 129 138T120 138T111 138T102 138T93 138T84 138T75 138T66 138T57 138H50V52C50 46.5 54.5 42 60 42Z"
    tilt={5}
  >
    <Badge context={context} size={18} x={62} y={54}>
      <Path d="M12 3.5L21.5 19.5H2.5Z" />
      <Path d="M12 10V14" />
      <Path d="M12 16.6V16.7" />
    </Badge>
    <Bar context={context} tone={0} width={54} x={62} y={82} />
    <Bar context={context} tone={1} width={64} x={62} y={96} />
    <Bar context={context} tone={2} width={44} x={62} y={110} />
  </Surface>
);

/** Permission denied: a rounded shield with a padlock badge above two skeleton lines. */
const permissionDenied: Scene = (context) => (
  <Surface
    context={context}
    d="M90 38C93.3 38 94.5 38.4 98 39.7L128 51C132.6 52.7 135 55.5 135 60V92C135 120 118 140 99 151C97 152 95 152 93 151C74 140 57 120 57 92V60C57 55.5 59.4 52.7 64 51L82 44C85.5 42.7 87.5 38 90 38Z"
    tilt={4}
  >
    <Badge context={context} size={20} x={86} y={66}>
      <Rect height={10} rx={3} width={14} x={5} y={11} />
      <Path d="M8 11V8C8 5.8 9.8 4 12 4S16 5.8 16 8V11" />
      <Path d="M12 15.2V16.8" />
    </Badge>
    <Bar context={context} tone={0} width={42} x={75} y={102} />
    <Bar context={context} tone={2} width={28} x={82} y={116} />
  </Surface>
);

export const EXTRA_SCENES = {
  "settings-muted-keywords": mutedKeywords,
  "settings-reader-no-highlights": readerNoHighlights,
  "settings-advanced-no-data": advancedNoData,
  "settings-feedback-sent": feedbackSent,
  offline,
  "load-error": loadError,
  "permission-denied": permissionDenied,
} as const;
