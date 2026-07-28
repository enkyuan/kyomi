import { googleIconDataUri } from "@kyomi/ui/icons/google";
import { Image } from "react-native";

export function GoogleLogoMark({ size = 20 }: { size?: number }) {
  return (
    <Image
      accessibilityElementsHidden
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      source={{ uri: googleIconDataUri }}
      style={{ height: size, width: size }}
    />
  );
}
