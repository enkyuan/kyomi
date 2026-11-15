import { View } from "react-native";

/** Stroke width that matches regular body text. */
export const ICON_STROKE = 1.5;

type IconProps = { readonly color: string; readonly size: number };

/**
 * Icons are drawn from plain `View`s (borders and rotation) so the reader package needs no SVG
 * dependency; the host never has to supply glyph fonts either.
 */
export function CheckMark({ color, size }: IconProps) {
  const w = size * 0.5;
  return (
    <View
      style={{
        borderBottomWidth: ICON_STROKE,
        borderColor: color,
        borderRightWidth: ICON_STROKE,
        height: w * 1.4,
        marginTop: -size * 0.08,
        transform: [{ rotate: "45deg" }],
        width: w * 0.7,
      }}
    />
  );
}

/** Rounded square for task items; filled with a check when `checked`. */
export function Checkbox({
  checked,
  color,
  size,
  background,
}: IconProps & { readonly checked: boolean; readonly background: string }) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: checked ? color : "transparent",
        borderColor: color,
        borderCurve: "continuous",
        borderRadius: size * 0.28,
        borderWidth: ICON_STROKE,
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      {checked ? <CheckMark color={background} size={size} /> : null}
    </View>
  );
}

/** Chevron pointing right, rotated 90 degrees down when `open`. */
export function Disclosure({ color, open, size }: IconProps & { readonly open: boolean }) {
  const s = size * 0.5;
  return (
    <View style={{ alignItems: "center", height: size, justifyContent: "center", width: size }}>
      <View
        style={{
          borderColor: color,
          borderRightWidth: ICON_STROKE,
          borderTopWidth: ICON_STROKE,
          height: s,
          marginLeft: open ? 0 : -s * 0.25,
          transform: [{ rotate: open ? "135deg" : "45deg" }],
          width: s,
        }}
      />
    </View>
  );
}

/** Two overlapping rounded squares. */
export function CopyIcon({ color, size }: IconProps) {
  const s = size * 0.62;
  const box = {
    borderColor: color,
    borderRadius: size * 0.14,
    borderWidth: ICON_STROKE,
    height: s,
    position: "absolute" as const,
    width: s,
  };
  return (
    <View style={{ height: size, width: size }}>
      <View style={{ ...box, right: 0, top: 0 }} />
      <View style={{ ...box, bottom: 0, left: 0 }} />
    </View>
  );
}

export function CheckIcon({ color, size }: IconProps) {
  return (
    <View style={{ alignItems: "center", height: size, justifyContent: "center", width: size }}>
      <CheckMark color={color} size={size} />
    </View>
  );
}
