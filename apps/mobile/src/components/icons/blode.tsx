import { BLODE_STROKE_WIDTH, type BlodeNativeIcon } from "@kyomi/ui/icons/blode-native";
import Svg, { Path, type SvgProps } from "react-native-svg";

export type BlodeIconProps = Omit<SvgProps, "color" | "height" | "viewBox" | "width"> & {
  readonly color?: string;
  readonly icon: BlodeNativeIcon;
  readonly size?: number;
  readonly strokeWidth?: number;
};

/** Draws renderer-neutral Blode geometry, so native never imports the DOM icon components. */
export function BlodeIcon({
  color = "currentColor",
  icon,
  size = 20,
  strokeWidth = BLODE_STROKE_WIDTH,
  ...props
}: BlodeIconProps) {
  return (
    <Svg
      accessibilityElementsHidden
      color={color}
      height={size}
      importantForAccessibility="no-hide-descendants"
      viewBox={icon.viewBox}
      width={size}
      {...props}
    >
      {icon.paths.map((path) =>
        path.stroke ? (
          <Path
            d={path.d}
            fill="none"
            key={path.d}
            stroke="currentColor"
            strokeLinecap={path.stroke.linecap}
            strokeLinejoin={path.stroke.linejoin}
            strokeWidth={strokeWidth}
          />
        ) : (
          <Path d={path.d} fill="currentColor" fillRule={path.fillRule} key={path.d} />
        ),
      )}
    </Svg>
  );
}
