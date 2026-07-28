import type { MingcuteNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import type { ColorValue } from "react-native";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

type MingcuteIconProps = {
  readonly icon: MingcuteNativeIcon;
  readonly color: ColorValue;
  readonly size?: number;
  readonly decorative?: boolean;
};

export function MingcuteIcon({ icon, color, size = 20, decorative = true }: MingcuteIconProps) {
  return (
    <View
      accessible={!decorative}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "auto"}
      style={{ width: size, height: size }}
    >
      <Svg
        accessibilityRole={decorative ? undefined : "image"}
        height={size}
        viewBox={icon.viewBox}
        width={size}
      >
        {icon.paths.map((path) => (
          <Path
            d={path.d}
            fill={color}
            fillRule={path.fillRule}
            key={`${path.d}:${path.fillRule ?? "nonzero"}`}
          />
        ))}
      </Svg>
    </View>
  );
}
