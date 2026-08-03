import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";

function supportsLiquidGlass() {
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    // Some iOS 26 beta runtimes exposed Liquid Glass without its API.
    return false;
  }
}

export function useLiquidGlassAvailable() {
  const [reduceTransparencyEnabled, setReduceTransparencyEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (isMounted) {
        setReduceTransparencyEnabled(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparencyEnabled,
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return !reduceTransparencyEnabled && supportsLiquidGlass();
}
