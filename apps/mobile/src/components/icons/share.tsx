import { ShareForwardLineNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import Svg, { Path, type SvgProps } from "react-native-svg";

export type ShareIconProps = Omit<SvgProps, "width" | "height" | "viewBox"> & {
  readonly size?: number;
};

export function ShareIcon({ size = 20, fill = "currentColor", ...props }: ShareIconProps) {
  return (
    <Svg
      accessibilityElementsHidden
      height={size}
      importantForAccessibility="no-hide-descendants"
      viewBox={ShareForwardLineNativeIcon.viewBox}
      width={size}
      {...props}
    >
      {ShareForwardLineNativeIcon.paths.map((path) => (
        <Path d={path.d} fill={fill} fillRule={path.fillRule} key={path.d} />
      ))}
    </Svg>
  );
}
