import { useEffect, useState } from "react";
import { Keyboard, Platform, type KeyboardEvent } from "react-native";

export function useKeyboard() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const updateHeight = (event: KeyboardEvent) => {
      Keyboard.scheduleLayoutAnimation(event);
      setHeight(event.endCoordinates.height);
    };
    const clearHeight = (event: KeyboardEvent) => {
      Keyboard.scheduleLayoutAnimation(event);
      setHeight(0);
    };
    const subscriptions = [
      Keyboard.addListener(
        Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
        updateHeight,
      ),
      Keyboard.addListener(
        Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
        clearHeight,
      ),
    ];

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  return { height, isVisible: height > 0 };
}
