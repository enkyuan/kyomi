import { G, Path } from "react-native-svg";
import { RssNativeIcon } from "@kyomi/ui/icons/blode-native";
import {
  BackPaper,
  Bar,
  Glyph,
  PAPER_FRAME,
  Paper,
  PaperLines,
  Surface,
  type Scene,
  type SceneContext,
} from "./parts";

/** A circle as path data, so every shape here is a single `Path`. */
function circle(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

/** A small hand-drawn badge stroke in the theme icon colour, the way the RSS glyph is drawn. */
function Badge({ context, d, width = 2 }: { context: SceneContext; d: string; width?: number }) {
  const { theme } = context;
  return (
    <G opacity={theme.iconOpacity}>
      <Path
        d={d}
        fill="none"
        stroke={theme.icon}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={width}
      />
    </G>
  );
}

/** An empty dashed slot, the "nothing here yet" mark. */
function Slot({ context, d }: { context: SceneContext; d: string }) {
  const { theme } = context;
  return (
    <Path
      d={d}
      fill="none"
      stroke={theme.border}
      strokeDasharray="3 5"
      strokeLinecap="round"
      strokeOpacity={theme.borderOpacity}
      strokeWidth={1.5}
    />
  );
}

/** A folder silhouette with a tab on the left, rounded everywhere. */
const FOLDER_BACK =
  "M52 46H77Q83 46 86 50.5L88 54Q90 58 96 58H140Q152 58 152 70V134Q152 146 140 146H52Q40 146 40 134V58Q40 46 52 46Z";
const FOLDER_FRONT = "M46 92Q46 82 56 82H136Q146 82 146 92V136Q146 146 136 146H56Q46 146 46 136Z";

/** The back flap of a folder drawn at half strength, as the original's back paper. */
function FolderBack({ context }: { context: SceneContext }) {
  return (
    <G transform="rotate(-4 96 96)">
      <Path
        d={FOLDER_BACK}
        fill={context.theme.lines[1]}
        fillOpacity={context.theme.lineOpacities[1] * 1.6}
      />
      <Path d={FOLDER_BACK} fill="none" stroke={context.paints.stroke} strokeLinecap="round" />
    </G>
  );
}

/** Papers fanned on both sides with a clock-and-arrow history badge. */
const recents: Scene = (context) => (
  <>
    <BackPaper context={context} tilt={-8} x={-6} y={2} />
    <BackPaper context={context} tilt={8} x={6} y={-2} />
    <Paper context={context}>
      <G transform={`${PAPER_FRAME} scale(1.2)`}>
        <Badge
          context={context}
          d="M1.6 8A6.4 6.4 0 1 0 3.6 3.4M1 1.6L1.6 4.4L4.4 3.8M8 4.8V8L10.2 9.4"
          width={1.6}
        />
      </G>
      <PaperLines context={context} count={3} top={30} />
    </Paper>
  </>
);

/** A paper whose rows are dashed empty placeholders under the RSS badge. */
const sourcesNone: Scene = (context) => (
  <>
    <BackPaper context={context} />
    <Paper context={context}>
      <G transform={PAPER_FRAME}>
        <Glyph context={context} icon={RssNativeIcon} size={16} />
        {[0, 1, 2].map((row) => (
          <G key={row}>
            <Slot context={context} d={circle(6.5, 38 + row * 20, 6)} />
            <Bar
              context={context}
              tone={row as 0 | 1 | 2}
              width={[44, 36, 40][row]}
              x={20}
              y={34.25 + row * 20}
            />
          </G>
        ))}
      </G>
    </Paper>
  </>
);

/** An open folder: back flap, a lower front panel and an empty dashed slot. */
const folderEmpty: Scene = (context) => (
  <>
    <FolderBack context={context} />
    <Surface context={context} d={FOLDER_FRONT} tilt={4} x={0} y={0}>
      <Slot
        context={context}
        d="M72 104H120Q126 104 126 110V120Q126 126 120 126H72Q66 126 66 120V110Q66 104 72 104Z"
      />
    </Surface>
  </>
);

/** A closed folder with a plus badge and two label lines, a faded folder behind. */
const foldersNone: Scene = (context) => (
  <>
    <G opacity={0.5} transform="rotate(-8 96 96) translate(-6 4)">
      <Path d={FOLDER_BACK} fill={context.paints.back} />
    </G>
    <Surface context={context} d={FOLDER_BACK} tilt={3}>
      <Badge context={context} d={`${circle(96, 98, 10)}M96 92.5V103.5M90.5 98H101.5`} />
      <Bar context={context} tone={0} width={44} x={74} y={118} />
      <Bar context={context} tone={2} width={28} x={82} y={130} />
    </Surface>
  </>
);

const LENS = circle(46, 62, 13);

/** The handle runs from the lens rim toward the paper's lower-right corner. */
const HANDLE = "M55.5 71.5L66 82";

/** A paper with a magnifier over its lower corner. */
const searchPrompt: Scene = (context) => (
  <>
    <BackPaper context={context} />
    <Paper context={context}>
      <PaperLines context={context} count={3} top={8} />
      <G transform={PAPER_FRAME}>
        <Path d={LENS} fill={context.paints.fill} />
        <Badge context={context} d={`${LENS}${HANDLE}`} width={2.2} />
      </G>
    </Paper>
  </>
);

/** The same magnifier with an x inside the lens over a paper tilted the other way. */
const searchNoResults: Scene = (context) => (
  <>
    <BackPaper context={context} tilt={-10} x={-4} y={0} />
    <Paper context={context} tilt={-6} x={-1} y={0}>
      <PaperLines context={context} count={2} first={1} top={8} />
      <G transform={PAPER_FRAME}>
        <Path d={LENS} fill={context.paints.fill} />
        <Badge
          context={context}
          d={`${LENS}${HANDLE}M41.5 57.5L50.5 66.5M50.5 57.5L41.5 66.5`}
          width={2.2}
        />
      </G>
    </Paper>
  </>
);

/** A file with a folded corner, two skeleton lines and an arrow dropping into a tray. */
const FILE =
  "M60 40H114Q118 40 120.8 42.8L139.2 61.2Q142 64 142 68V142Q142 152 132 152H60Q50 152 50 142V50Q50 40 60 40Z";
const FILE_FLAP = "M114 40V56Q114 66 124 66H142L120.8 42.8Q118 40 114 40Z";

const importOpml: Scene = (context) => (
  <>
    <BackPaper context={context} tilt={-8} x={-6} y={2} />
    <Surface context={context} d={FILE} tilt={4}>
      <Path d={FILE_FLAP} fill={context.paints.back} />
      <Path
        d={FILE_FLAP}
        fill="none"
        stroke={context.paints.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Bar context={context} tone={0} width={44} x={64} y={72} />
      <Bar context={context} tone={1} width={32} x={64} y={86} />
      <Badge
        context={context}
        d="M96 104V127M87.5 118.5L96 127L104.5 118.5M80 131V138Q80 142 84 142H108Q112 142 112 138V131"
      />
    </Surface>
  </>
);

export const LIBRARY_SCENES = {
  recents,
  "sources-none": sourcesNone,
  "folder-empty": folderEmpty,
  "folders-none": foldersNone,
  "search-prompt": searchPrompt,
  "search-no-results": searchNoResults,
  "import-opml": importOpml,
} as const;
