import { useEffect } from "react";
import { AppState } from "react-native";
import { readingProgressSync } from "../lib/progress-store";

/** Sends reading progress that could not be sent, now and each time the app returns to the foreground. */
export function useBufferedProgressRetry() {
  useEffect(() => {
    void readingProgressSync.retryBuffered();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void readingProgressSync.retryBuffered();
    });
    return () => subscription.remove();
  }, []);
}
