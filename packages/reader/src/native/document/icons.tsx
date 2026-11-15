import { View } from "react-native";
import { Path, Svg } from "react-native-svg";

/** Stroke width that matches regular body text. */
export const ICON_STROKE = 1.5;

type IconProps = { readonly color: string; readonly size: number };

/**
 * The task checkbox, disclosure and check mark are drawn from plain `View`s (borders and rotation);
 * the copy and check glyphs of the code block's button are Blode paths drawn with `react-native-svg`
 * (an optional peer), so they match the web button exactly. The host never supplies glyph fonts.
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

/**
 * The code block's copy glyph: Blode's `FilesFilledIcon`, the same geometry the web button draws
 * (`web/lib/code-copy-button.ts`), on its 24px grid.
 */
export function CopyIcon({ color, size }: IconProps) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path
        clipRule="evenodd"
        d="M17.8986 18.8987C17.4908 20.6751 15.9002 22 14 22H8c-2.2091 0-4-1.7909-4-4V9c0-1.9001 1.325-3.4908 3.1014-3.8986C7.5092 3.3249 9.0999 2 11 2h3v4c0 1.6569 1.3431 3 3 3h4v6c0 1.9002-1.3249 3.4909-3.1014 3.8987M7 7.2676C6.4022 7.6134 6 8.2597 6 9v9c0 1.1046.8954 2 2 2h6c.7403 0 1.3866-.4022 1.7324-1H11c-2.2091 0-4-1.7909-4-4z"
        fill={color}
        fillRule="evenodd"
      />
      <Path d="M16 2.5858 20.4142 7H17c-.5523 0-1-.4477-1-1z" fill={color} />
    </Svg>
  );
}

/** Blode's `Checkmark1Icon`, a 2-unit round-capped line on a 24px grid, as on the web button. */
export function CheckIcon({ color, size }: IconProps) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path
        d="M5 12.75 10 19l9-14"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </Svg>
  );
}
