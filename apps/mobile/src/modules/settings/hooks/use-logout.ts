import { useState } from "react";
import { Alert } from "react-native";
import { authClient } from "@/lib/auth";
import { clearUserData } from "@modules/auth/lib/user-data";

const LOGOUT_ERROR_MESSAGE = "Unable to log out. Try again.";

export function useLogout() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  function logout() {
    if (isLoggingOut) return;

    setErrorMessage(null);
    setIsLoggingOut(true);
    // The auth client drops the stored session and flips the session atom before it sends the
    // request, so the device is signed out whether or not the server answered. The account's data
    // goes with it either way; clearing only after the request settles means the signed-in screens
    // are already gone and cannot refetch into the emptied stores.
    const finish = (message: string | null) => {
      try {
        clearUserData();
      } finally {
        setErrorMessage(message);
        setIsLoggingOut(false);
      }
    };
    void authClient.signOut().then(
      (result: Awaited<ReturnType<typeof authClient.signOut>>) =>
        finish(result?.error ? LOGOUT_ERROR_MESSAGE : null),
      () => finish(LOGOUT_ERROR_MESSAGE),
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
