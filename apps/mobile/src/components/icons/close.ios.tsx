import { SymbolView } from "expo-symbols";
import type { CloseIconProps } from "./close";

export function CloseIcon({ color = "currentColor", size = 20 }: CloseIconProps) {
  return (
    <SymbolView
      accessibilityElementsHidden
      name="xmark"
      size={size}
      tintColor={color === "currentColor" ? undefined : color}
      weight="regular"
    />
  );
}
