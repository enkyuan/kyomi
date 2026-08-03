import { More1LineNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import Svg, { Path, type SvgProps } from "react-native-svg";

export type MoreIconProps = Omit<SvgProps, "width" | "height" | "viewBox"> & {
  readonly size?: number;
};

export function MoreIcon({ size = 20, fill = "currentColor", ...props }: MoreIconProps) {
  return (
    <Svg
      accessibilityElementsHidden
      height={size}
      importantForAccessibility="no-hide-descendants"
      viewBox={More1LineNativeIcon.viewBox}
      width={size}
      {...props}
    >
      {More1LineNativeIcon.paths.map((path) => (
        <Path d={path.d} fill={fill} fillRule={path.fillRule} key={path.d} />
      ))}
    </Svg>
  );
}
