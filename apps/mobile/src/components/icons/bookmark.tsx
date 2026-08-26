import { BookmarkFillNativeIcon, BookmarkLineNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import Svg, { Path, type SvgProps } from "react-native-svg";

export type BookmarkIconProps = Omit<SvgProps, "width" | "height" | "viewBox"> & {
  readonly size?: number;
  readonly focused?: boolean;
};

export function BookmarkIcon({
  size = 20,
  fill = "currentColor",
  focused = false,
  ...props
}: BookmarkIconProps) {
  const icon = focused ? BookmarkFillNativeIcon : BookmarkLineNativeIcon;

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
