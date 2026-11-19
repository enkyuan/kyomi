import type { ReactNode } from "react";
import { G, Path } from "react-native-svg";
import { RssNativeIcon } from "@kyomi/ui/icons/blode-native";
import { Bar, Glyph, Surface, type Scene, type SceneContext } from "./parts";

/** A circle as path data, so every shape here is a single `Path`. */
function circle(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

/** A rounded rectangle as path data. */
function box(x: number, y: number, w: number, h: number, r: number) {
  return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
}

/** A small hand-drawn stroke in the theme icon colour, the way the RSS glyph is drawn. */
function Accent({ context, d, width = 2.2 }: { context: SceneContext; d: string; width?: number }) {
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

/** A dashed "nothing here yet" outline, optionally faded to read as a ghost of what will land. */
function Slot({ context, d, opacity = 1 }: { context: SceneContext; d: string; opacity?: number }) {
  const { theme } = context;
  return (
    <Path
      d={d}
      fill="none"
      opacity={opacity}
      stroke={theme.border}
      strokeDasharray="3 5"
      strokeLinecap="round"
      strokeOpacity={theme.borderOpacity}
      strokeWidth={1.5}
    />
  );
}

/** A soft radial wash behind a hero object, built only from the theme line tones. */
function Wash({ context, r = 58 }: { context: SceneContext; r?: number }) {
  const { theme } = context;
  return (
    <>
      <Path d={circle(96, 96, r)} fill={theme.lines[1]} fillOpacity={theme.lineOpacities[1]} />
      <Path
        d={circle(96, 96, r - 12)}
        fill={theme.lines[0]}
        fillOpacity={theme.lineOpacities[0] * 0.5}
      />
    </>
  );
}

/** A clock face, upright and centred, with a dashed arc trailing off to the left for "history". */
const recents: Scene = (context) => (
  <>
    <Wash context={context} />
    <Slot context={context} d="M60 70.8A44 44 0 0 0 60 121.2" />
    <Surface context={context} d={circle(98, 96, 34)}>
      {[
        [98, 69],
        [125, 96],
        [98, 123],
        [71, 96],
      ].map(([x, y]) => (
        <Path
          d={circle(x, y, 1.8)}
          fill={context.theme.lines[0]}
          fillOpacity={context.theme.lineOpacities[0]}
          key={`${x}-${y}`}
        />
      ))}
      <Accent context={context} d="M98 96V79M98 96L110 103" width={3} />
    </Surface>
  </>
);

/** A row of three tiles on a slight rise: one solid RSS tile, then two fading ghosts. */
const sourcesNone: Scene = (context) => (
  <G transform="rotate(-6 96 96)">
    <Surface context={context} d={box(34, 74, 40, 40, 13)}>
      <Glyph context={context} icon={RssNativeIcon} size={22} x={43} y={83} />
    </Surface>
    <Slot context={context} d={box(76, 74, 40, 40, 13)} opacity={0.85} />
    <Slot context={context} d={box(118, 74, 40, 40, 13)} opacity={0.45} />
  </G>
);

/** A large upright open folder, flat, with a faint dashed file peeking out and an empty slot. */
const FOLDER_BACK =
  "M52 56H78Q84 56 87 60.5L89 64Q91 68 97 68H140Q152 68 152 80V132Q152 144 140 144H52Q40 144 40 132V68Q40 56 52 56Z";
const FOLDER_FRONT = "M40 92Q40 82 50 82H142Q152 82 152 92V134Q152 144 142 144H50Q40 144 40 134Z";

const folderEmpty: Scene = (context) => (
  <>
    <Slot context={context} d={box(62, 38, 68, 44, 10)} opacity={0.8} />
    <Surface context={context} d={FOLDER_BACK} />
    <Surface context={context} d={FOLDER_FRONT}>
      <Slot context={context} d={box(70, 98, 52, 30, 9)} />
    </Surface>
  </>
);

/** A faint ghost folder with one solid round plus button overlapping its corner. */
const foldersNone: Scene = (context) => (
  <>
    <G transform="rotate(-6 96 96) translate(-4 -2)">
      <Slot
        context={context}
        d="M52 58H76Q82 58 85 62L87 65Q89 69 95 69H132Q142 69 142 79V118Q142 128 132 128H52Q42 128 42 118V68Q42 58 52 58Z"
      />
    </G>
    <Surface context={context} d={circle(124, 124, 21)}>
      <Accent context={context} d="M124 114V134M114 124H134" width={2.6} />
    </Surface>
  </>
);

/**
 * One outline for lens and handle: the lens circle runs the long way round and leaves where the
 * handle's two sides meet it, so there is no seam, overlap or second edge between them.
 */
function magnifierPath(cx: number, cy: number, radius: number, half: number, tip: number) {
  const angle = Math.PI / 4;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const nx = -uy;
  const ny = ux;
  const reach = Math.sqrt(radius * radius - half * half);
  const point = (along: number, across: number) =>
    `${(cx + ux * along + nx * across).toFixed(2)} ${(cy + uy * along + ny * across).toFixed(2)}`;
  const end = tip - half;
  return [
    `M${point(reach, half)}`,
    `L${point(end, half)}`,
    `A${half} ${half} 0 0 0 ${point(end, -half)}`,
    `L${point(reach, -half)}`,
    `A${radius} ${radius} 0 1 0 ${point(reach, half)}`,
    "Z",
  ].join("");
}

/** Magnifier: lens and handle are one silhouette, with a recessed glass inside. */
function Magnifier({
  children,
  context,
  mirrored = false,
}: {
  children?: ReactNode;
  context: SceneContext;
  mirrored?: boolean;
}) {
  return (
    <G
      transform={`${mirrored ? "translate(192 0) scale(-1 1) " : ""}translate(96 96) scale(1.18) translate(-97 -95)`}
    >
      <Surface context={context} d={magnifierPath(86, 84, 31, 6.5, 62)} />
      <Path
        d={circle(86, 84, 23)}
        fill={context.theme.lines[1]}
        fillOpacity={context.theme.lineOpacities[1]}
      />
      {children}
    </G>
  );
}

/** A big magnifier with a text cursor in the lens and two faint result rows beside it. */
const searchPrompt: Scene = (context) => (
  <>
    <Magnifier context={context}>
      <Accent context={context} d="M77 73V95" width={2.6} />
      <Bar context={context} tone={1} width={20} x={85} y={74} />
      <Bar context={context} tone={2} width={14} x={85} y={91} />
    </Magnifier>
  </>
);

/** The magnifier mirrored over a soft wash: an empty dashed ring and an x, no paper. */
const searchNoResults: Scene = (context) => (
  <>
    <Wash context={context} r={60} />
    <Magnifier context={context} mirrored>
      <Slot context={context} d={circle(86, 84, 21)} />
      <Accent context={context} d="M79 77L93 91M93 77L79 91" width={2.6} />
    </Magnifier>
  </>
);

/** A file arriving into an inbox tray: file drawn first so the tray front overlaps it. */
const TRAY =
  "M44 112H64Q68 112 70 116L72 120Q74 124 78 124H114Q118 124 120 120L122 116Q124 112 128 112H148V136Q148 148 136 148H56Q44 148 44 136Z";

const importOpml: Scene = (context) => (
  <>
    <G transform="rotate(8 96 80)">
      <Surface context={context} d={box(68, 40, 56, 76, 12)}>
        <Accent context={context} d="M96 56V82M86 73L96 83L106 73" width={2.4} />
      </Surface>
    </G>
    <Surface context={context} d={TRAY}>
      <Bar context={context} tone={1} width={26} x={83} y={133} />
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
