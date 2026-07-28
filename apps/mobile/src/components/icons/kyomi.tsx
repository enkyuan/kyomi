import { KyomiLogoNativeIcon } from "@kyomi/ui/icons/kyomi-logo-native";
import { kyomiNativeBrand } from "@kyomi/ui/native/theme";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

export function KyomiIcon({ size = 32 }: { size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: size, width: size }}
    >
      <Svg height={size} viewBox={KyomiLogoNativeIcon.viewBox} width={size}>
        {KyomiLogoNativeIcon.paths.map((path) => (
          <Path d={path.d} fill={kyomiNativeBrand.matcha.color} key={path.d} />
        ))}
      </Svg>
    </View>
  );
}
