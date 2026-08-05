import { SearchLineNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import Svg, { Path, type SvgProps } from "react-native-svg";

export type SearchIconProps = Omit<SvgProps, "width" | "height" | "viewBox"> & {
  readonly size?: number;
};

export function SearchIcon({ size = 20, fill = "currentColor", ...props }: SearchIconProps) {
  return (
    <Svg
      accessibilityElementsHidden
      height={size}
      importantForAccessibility="no-hide-descendants"
      viewBox={SearchLineNativeIcon.viewBox}
      width={size}
      {...props}
    >
      {SearchLineNativeIcon.paths.map((path) => (
        <Path d={path.d} fill={fill} fillRule={path.fillRule} key={path.d} />
      ))}
    </Svg>
  );
}
