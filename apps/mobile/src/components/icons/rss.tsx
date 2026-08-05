import { RssIconGeometry } from "@kyomi/ui/icons/rss";
import Svg, { Path, type SvgProps } from "react-native-svg";

export type RssIconProps = Omit<SvgProps, "width" | "height"> & {
  size?: number;
};

export function RssIcon({ size = 20, fill = "currentColor", ...props }: RssIconProps) {
  return (
    <Svg
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      height={size}
      viewBox={RssIconGeometry.viewBox}
      width={size}
      {...props}
    >
      <Path d={RssIconGeometry.fill.d} fill={fill} />
    </Svg>
  );
}
