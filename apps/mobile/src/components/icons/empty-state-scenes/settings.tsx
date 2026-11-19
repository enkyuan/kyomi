import { Circle, G, Path } from "react-native-svg";
import { Bar, Surface, type Scene, type SceneContext } from "./parts";

/** A stroke in the theme icon colour: the one accent each scene is allowed. */
function Accent({ context, d, width = 3.5 }: { context: SceneContext; d: string; width?: number }) {
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

/** A quiet stroke in the border tone, for dashed ghosts and faint marks. */
function Faint({
  context,
  d,
  dash,
  width = 2.5,
}: {
  context: SceneContext;
  d: string;
  dash?: string;
  width?: number;
}) {
  const { theme } = context;
  return (
    <Path
      d={d}
      fill="none"
      opacity={theme.borderOpacity}
      stroke={theme.border}
      strokeDasharray={dash}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={width}
    />
  );
}

function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
}

const BELL =
  "M96 44C79 44 67 57 67 73V96C67 104 62 108 58.5 114C55.5 119 58.5 126 64.5 126H127.5C133.5 126 136.5 119 133.5 114C130 108 125 104 125 96V73C125 57 113 44 96 44ZM85 133C85 139.5 89.5 144 96 144C102.5 144 107 139.5 107 133Z";

/** A big upright bell on a soft radial wash, its sound arcs cut short, one slash across it. */
const notificationsOff: Scene = (context) => {
  const { theme } = context;
  return (
    <>
      <Circle cx={96} cy={96} fill={theme.lines[1]} fillOpacity={theme.lineOpacities[1]} r={62} />
      <Circle cx={96} cy={96} fill={theme.lines[0]} fillOpacity={theme.lineOpacities[0]} r={48} />
      <Faint context={context} d="M141 82Q147 96 141 110" />
      <Faint context={context} d="M51 82Q45 96 51 110" />
      <Surface context={context} d={BELL} />
      {theme.isDark ? null : (
        <Path
          d="M64 60L128 132"
          fill="none"
          stroke={context.paints.fill}
          strokeLinecap="round"
          strokeWidth={9}
        />
      )}
      <Accent context={context} d="M64 60L128 132" width={4} />
    </>
  );
};

/** A solid phone beside a dashed ghost of the second device that has not signed in yet. */
const noDevices: Scene = (context) => (
  <>
    <Faint context={context} d={roundedRect(108, 78, 48, 66, 12)} dash="4 5" width={2.5} />
    <Accent context={context} d="M132 104V120M124 112H140" width={3.5} />
    <Surface context={context} d={roundedRect(42, 46, 52, 98, 13)} tilt={-6}>
      <Bar context={context} height={6} tone={1} width={14} x={61} y={55} />
      <Bar context={context} tone={2} width={32} x={52} y={78} />
      <Bar context={context} tone={3} width={22} x={52} y={92} />
      <Bar context={context} height={5} tone={0} width={20} x={58} y={132} />
    </Surface>
  </>
);

/** An upright receipt, torn along the bottom, whose total is a lone zero. */
function receiptPath() {
  const left = 66;
  const right = 126;
  const teeth = 4;
  const step = (right - left) / teeth;
  let d = `M${left + 9} 42H${right - 9}Q${right} 42 ${right} 51V142`;
  for (let i = 0; i < teeth; i += 1) {
    const x = right - step * i;
    d += `L${x - step / 2} 150L${x - step} 142`;
  }
  return `${d}V51Q${left} 42 ${left + 9} 42Z`;
}

const billingNoInvoices: Scene = (context) => (
  <>
    <Surface context={context} d={receiptPath()} tilt={-7}>
      <Bar context={context} tone={0} width={26} x={83} y={56} />
      <Faint context={context} d="M78 82H114" dash="3 5" width={2} />
      <Bar context={context} tone={2} width={14} x={78} y={95} />
      <Bar context={context} tone={2} width={14} x={100} y={95} />
      <Accent
        context={context}
        d="M96 108C91.5 108 89.5 112 89.5 117.5C89.5 123 91.5 127 96 127C100.5 127 102.5 123 102.5 117.5C102.5 112 100.5 108 96 108Z"
        width={3.5}
      />
    </Surface>
  </>
);

const SHIELD =
  "M96 40L132 51C136 52 138 54.5 138 58V92C138 116 120 138 96 150C72 138 54 116 54 92V58C54 54.5 56 52 60 51Z";

/** A shield dropped in front of a feed tile, one cross on its face. */
const blockedSources: Scene = (context) => (
  <>
    <G opacity={0.5} transform="translate(0 0) rotate(-9 60 118)">
      <Surface context={context} d={roundedRect(36, 94, 48, 48, 13)} />
    </G>
    <Faint context={context} d="M50 128H50.01" width={5} />
    <Faint context={context} d="M50 114A14 14 0 0 1 64 128" />
    <Faint context={context} d="M50 102A26 26 0 0 1 76 128" />
    <Surface context={context} d={SHIELD} x={14} y={-4}>
      <Accent context={context} d="M99 81L117 99M117 81L99 99" width={4} />
    </Surface>
  </>
);

export const SETTINGS_SCENES = {
  "settings-notifications-off": notificationsOff,
  "settings-no-devices": noDevices,
  "settings-billing-no-invoices": billingNoInvoices,
  "settings-blocked-sources": blockedSources,
} as const;
