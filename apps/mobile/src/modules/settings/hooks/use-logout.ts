import { useState } from "react";
import { Alert } from "react-native";
import { authClient } from "@/lib/auth";

const LOGOUT_ERROR_MESSAGE = "Unable to log out. Try again.";

export function useLogout() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  function logout() {
    if (isLoggingOut) return;

    setErrorMessage(null);
    setIsLoggingOut(true);
    void authClient.signOut().then(
      (result: Awaited<ReturnType<typeof authClient.signOut>>) => {
        if (result?.error) setErrorMessage(LOGOUT_ERROR_MESSAGE);
        setIsLoggingOut(false);
      },
      () => {
        setErrorMessage(LOGOUT_ERROR_MESSAGE);
        setIsLoggingOut(false);
      },
    );
  }

  function confirmLogout() {
    if (isLoggingOut) return;

    Alert.alert("Log out?", "You'll need to sign in again to access your feeds.", [
      { text: "Cancel", style: "cancel" },
      { onPress: () => void logout(), style: "destructive", text: "Log out" },
    ]);
  }

  return { confirmLogout, errorMessage, isLoggingOut };
}
