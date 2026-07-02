"use client";

import { useRouter } from "@tanstack/react-router";
import { authClient } from "@lib/auth/client";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import { toastManager } from "@kyomi/ui/toast";

type UseSettingsLogoutArgs = {
  onOpenChange: (open: boolean) => void;
};

export function useSettingsLogout({ onOpenChange }: UseSettingsLogoutArgs) {
  const router = useRouter();

  const logout = async () => {
    await toastManager.promise(
      (async () => {
        const result = await authClient.signOut();

        if (result?.error) {
          throw new Error(result.error.message?.trim() || "Unable to log out");
        }

        onOpenChange(false);
        await router.invalidate();
        await router.navigate({ to: "/" });
      })(),
      {
        error: (error) => {
          logClientError("settings.logout", error);
          return {
            description: getUserSafeErrorMessage(error, "Unable to log out"),
            title: "Log out failed",
            type: "error",
          };
        },
        loading: {
          description: "Ending your current session.",
          timeout: 0,
          title: "Logging out...",
          type: "loading",
        },
        success: {
          description: "You have been signed out.",
          title: "Logged out",
          type: "success",
        },
      },
    );
  };

  return { logout };
}
