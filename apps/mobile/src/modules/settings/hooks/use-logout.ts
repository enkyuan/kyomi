import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { authClient } from "@/lib/auth";

const LOGOUT_ERROR_MESSAGE = "Unable to log out. Try again.";

export function useLogout() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = useCallback(async () => {
    if (isLoggingOut) return;

    setErrorMessage(null);
    setIsLoggingOut(true);

    try {
      const result = await authClient.signOut();
      if (result?.error) setErrorMessage(LOGOUT_ERROR_MESSAGE);
    } catch {
      setErrorMessage(LOGOUT_ERROR_MESSAGE);
    } finally {
      setIsLoggingOut(false);
    }
  }, [isLoggingOut]);

  const confirmLogout = useCallback(() => {
    if (isLoggingOut) return;

    Alert.alert("Log out?", "You'll need to sign in again to access your feeds.", [
      { text: "Cancel", style: "cancel" },
      { onPress: () => void logout(), style: "destructive", text: "Log out" },
    ]);
  }, [isLoggingOut, logout]);

  return { confirmLogout, errorMessage, isLoggingOut };
}
