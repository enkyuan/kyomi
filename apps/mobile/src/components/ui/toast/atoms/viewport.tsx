import { useEffect, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { engine } from "../lib/manager";

/** Synchronizes the native toast overlay with system navigation chrome. */
export function ToastViewport() {
  const insets = useSafeAreaInsets();
  const safeArea = useMemo(
    () => ({ bottom: insets.bottom, top: insets.top }),
    [insets.bottom, insets.top],
  );

  useEffect(() => {
    void engine.setDefaults({ safeArea });
  }, [safeArea]);

  return null;
}
