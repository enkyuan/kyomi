import type { MingcuteNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import Svg, { Path, type SvgProps } from "react-native-svg";

export type MingcuteIconProps = Omit<SvgProps, "height" | "viewBox" | "width"> & {
  readonly icon: MingcuteNativeIcon;
  readonly size?: number;
};

/** Renders renderer-neutral Mingcute geometry without importing DOM icon components into native. */
export function MingcuteIcon({ icon, size = 20, fill = "#0B0B0C", ...props }: MingcuteIconProps) {
  return (
    <Svg
      accessibilityElementsHidden
      height={size}
      importantForAccessibility="no-hide-descendants"
      viewBox={icon.viewBox}
      width={size}
      {...props}
    >
      {icon.paths.map((path) => (
        <Path d={path.d} fill={fill} fillRule={path.fillRule} key={path.d} />
      ))}
    </Svg>
  );
}
