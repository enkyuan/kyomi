import { SymbolView } from "expo-symbols";
import type { CloseIconProps } from "./close";

export function CloseIcon({ fill = "currentColor", size = 20 }: CloseIconProps) {
  return (
    <SymbolView
      accessibilityElementsHidden
      name="xmark"
      size={size}
      tintColor={fill === "currentColor" ? undefined : fill}
      weight="regular"
    />
  );
}
