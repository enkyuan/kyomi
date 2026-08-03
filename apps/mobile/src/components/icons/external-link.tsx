import { ExternalLinkLineNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import Svg, { Path, type SvgProps } from "react-native-svg";

export type ExternalLinkIconProps = Omit<SvgProps, "width" | "height" | "viewBox"> & {
  readonly size?: number;
};

export function ExternalLinkIcon({
  size = 20,
  fill = "currentColor",
  ...props
}: ExternalLinkIconProps) {
  return (
    <Svg
      accessibilityElementsHidden
      height={size}
      importantForAccessibility="no-hide-descendants"
      viewBox={ExternalLinkLineNativeIcon.viewBox}
      width={size}
      {...props}
    >
      {ExternalLinkLineNativeIcon.paths.map((path) => (
        <Path d={path.d} fill={fill} fillRule={path.fillRule} key={path.d} />
      ))}
    </Svg>
  );
}
