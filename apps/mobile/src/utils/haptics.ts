import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/** Haptics enhance an accepted selection but never delay navigation if unavailable. */
export function triggerSelectionHaptic(): Promise<void> {
  return Haptics.selectionAsync().catch(() => undefined);
}

/** Haptics affirm an optimistic saved-state toggle without delaying the mutation. */
export function triggerSavedToggleHaptic(nextIsSaved: boolean): Promise<void> {
  if (Platform.OS === "android") {
    return Haptics.performAndroidHapticsAsync(
      nextIsSaved ? Haptics.AndroidHaptics.Toggle_On : Haptics.AndroidHaptics.Toggle_Off,
    ).catch(() => undefined);
  }

  return Haptics.selectionAsync().catch(() => undefined);
}
