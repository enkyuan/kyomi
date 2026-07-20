"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { authClient } from "@lib/auth/client";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import { clearHotQueryCache } from "@lib/query/cache";
import { toastManager } from "@kyomi/ui/toast";

type UseSettingsLogoutArgs = {
  onOpenChange?: (open: boolean) => void;
};

export function useSettingsLogout({ onOpenChange }: UseSettingsLogoutArgs) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const logout = async () => {
    await toastManager.promise(
      (async () => {
        const result = await authClient.signOut();

        if (result?.error) {
          throw new Error(result.error.message?.trim() || "Unable to log out");
        }

        onOpenChange?.(false);
        queryClient.clear();
        await clearHotQueryCache();
        await router.invalidate();
        await router.navigate({ to: "/", search: { redirect: undefined }, replace: true });
      })(),
      {
        error: (error) => {
          logClientError("settings.logout", error);
          return {
            title: getUserSafeErrorMessage(error, "Unable to log out"),
            type: "error",
          };
        },
        loading: {
          timeout: 0,
          title: "Logging out...",
          type: "loading",
        },
        success: {
          title: "Logged out",
          type: "success",
        },
      },
    );
  };

  return { logout };
}
