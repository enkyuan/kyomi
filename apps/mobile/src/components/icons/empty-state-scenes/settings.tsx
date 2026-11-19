import { Circle, G, Path } from "react-native-svg";
import { Bar, Surface, type Scene, type SceneContext } from "./parts";

/** Small hand-drawn stroke badge in the theme icon colour, drawn in canvas space. */
function Badge({ context, d, width = 3 }: { context: SceneContext; d: string; width?: number }) {
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

function Ring({
  context,
  cx,
  cy,
  r,
}: {
  context: SceneContext;
  cx: number;
  cy: number;
  r: number;
}) {
  const { theme } = context;
  return (
    <Circle
      cx={cx}
      cy={cy}
      fill="none"
      opacity={theme.iconOpacity}
      r={r}
      stroke={theme.icon}
      strokeWidth={3}
    />
  );
}

/** A rounded-rectangle path, used for the phones. */
function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
}

const BELL =
  "M96 44C79 44 67 57 67 73V96C67 104 62 108 58.5 114C55.5 119 58.5 126 64.5 126H127.5C133.5 126 136.5 119 133.5 114C130 108 125 104 125 96V73C125 57 113 44 96 44ZM85 133C85 139.5 89.5 144 96 144C102.5 144 107 139.5 107 133Z";

/** A bell with skeleton lines and a "no" sign. */
const notificationsOff: Scene = (context) => (
  <>
    <Surface context={context} d={BELL} tilt={5}>
      <Bar context={context} tone={0} width={30} x={81} y={70} />
      <Bar context={context} tone={1} width={40} x={81} y={85} />
      <Bar context={context} tone={2} width={22} x={81} y={100} />
      <Circle cx={126} cy={122} fill={context.paints.fill} r={13} />
      <Ring context={context} cx={126} cy={122} r={11} />
      <Badge context={context} d="M118.5 129.5L133.5 114.5" />
    </Surface>
  </>
);

const PHONE = roundedRect(68, 40, 62, 112, 15);

/** A phone with a screen of skeleton lines, a second one fanned behind and a plus badge. */
const noDevices: Scene = (context) => (
  <>
    <G opacity={0.5}>
      <Path
        d={roundedRect(68, 40, 62, 112, 15)}
        fill={context.paints.back}
        transform="translate(-14 4) rotate(-9 96 96)"
      />
    </G>
    <Surface context={context} d={PHONE} tilt={5}>
      <Bar context={context} tone={1} width={18} x={90} y={50} />
      <Bar context={context} tone={0} width={38} x={80} y={72} />
      <Bar context={context} tone={1} width={30} x={80} y={87} />
      <Bar context={context} tone={2} width={36} x={80} y={102} />
      <Ring context={context} cx={99} cy={129} r={9} />
      <Badge context={context} d="M99 124.5V133.5M94.5 129H103.5" width={2.5} />
    </Surface>
  </>
);

/** A zig-zag torn edge along the bottom of the receipt, softened at each vertex. */
function receiptPath() {
  const left = 58;
  const right = 134;
  const teeth = 5;
  const step = (right - left) / teeth;
  let d = `M${left + 10} 40H${right - 10}Q${right} 40 ${right} 50V142`;
  for (let i = 0; i < teeth; i += 1) {
    const x = right - step * i;
    d += `Q${x - step * 0.25} 150 ${x - step / 2} 150Q${x - step * 0.75} 150 ${x - step} 142`;
  }
  return `${d}V50Q${left} 40 ${left + 10} 40Z`;
}

/** A receipt with a torn zig-zag edge, line items and a coin badge. */
const billingNoInvoices: Scene = (context) => (
  <>
    <Surface context={context} d={receiptPath()} tilt={5}>
      <Ring context={context} cx={96} cy={58} r={8} />
      <Badge context={context} d="M92.5 58H99.5" width={2.5} />
      <Bar context={context} tone={0} width={28} x={70} y={80} />
      <Bar context={context} tone={0} width={14} x={106} y={80} />
      <Bar context={context} tone={1} width={34} x={70} y={95} />
      <Bar context={context} tone={1} width={14} x={106} y={95} />
      <Bar context={context} tone={2} width={24} x={70} y={110} />
      <Bar context={context} tone={2} width={14} x={106} y={110} />
      <Bar context={context} tone={3} width={50} x={70} y={127} />
    </Surface>
  </>
);

const SHIELD =
  "M96 40L132 51C136 52 138 54.5 138 58V92C138 116 120 138 96 150C72 138 54 116 54 92V58C54 54.5 56 52 60 51Z";

/** A shield with skeleton lines and an x badge. */
const blockedSources: Scene = (context) => (
  <>
    <Surface context={context} d={SHIELD} tilt={5}>
      <Bar context={context} tone={0} width={44} x={74} y={66} />
      <Bar context={context} tone={1} width={32} x={74} y={80} />
      <Ring context={context} cx={96} cy={110} r={12} />
      <Badge context={context} d="M91.5 105.5L100.5 114.5M100.5 105.5L91.5 114.5" width={2.5} />
    </Surface>
  </>
);

export const SETTINGS_SCENES = {
  "settings-notifications-off": notificationsOff,
  "settings-no-devices": noDevices,
  "settings-billing-no-invoices": billingNoInvoices,
  "settings-blocked-sources": blockedSources,
} as const;
