"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { logClientError, readResponseErrorSummary } from "@kyomi/reader/lib/errors";
import { toastManager } from "@kyomi/ui/components/toast";
import {
  authSessionsQueryKey,
  parseApiErrorMessage,
  parseSessionsResponse,
  postAuthSessionAction,
} from "../lib/session/api";
import { describeSessionDevice } from "../lib/session/device";
import { formatTimestamp, normalizeTimestamp } from "../lib/session/format";
import { describeSessionLocation } from "../lib/session/location";
import type { SessionRow, UseAccountPanelArgs } from "../lib/session/types";

export function useAccountPanel({ session }: UseAccountPanelArgs) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isEditingEmail, setIsEditingEmail] = useState(false);

  const { data: sessionsData, isError: isSessionsError } = useQuery({
    queryKey: authSessionsQueryKey(),
    queryFn: async (): Promise<SessionRow[]> => {
      try {
        const response = await fetch("/api/auth/list-sessions", {
          credentials: "include",
          method: "GET",
        });
        if (!response.ok) {
          throw new Error(await readResponseErrorSummary(response));
        }
        const data: unknown = await response.json();
        return parseSessionsResponse(data);
      } catch (error) {
        logClientError("settings.account.sessions", error);
        throw error;
      }
    },
    retry: 1,
  });

  const revokeOtherSessionsMutation = useMutation({
    mutationFn: async () => {
      await postAuthSessionAction("/api/auth/revoke-other-sessions");
    },
    onSuccess: async () => {
      toastManager.add({
        title: "Other sessions signed out",
        description: "Only this device remains active.",
        type: "success",
      });
      await queryClient.invalidateQueries({ queryKey: authSessionsQueryKey() });
      await router.invalidate();
    },
    onError: (error) => {
      logClientError("settings.account.revoke_other_sessions", error);
      toastManager.add({
        title: "Unable to sign out other sessions",
        description: parseApiErrorMessage(error, "Unable to sign out other sessions. Try again."),
        type: "error",
      });
    },
  });

  const revokeAllSessionsMutation = useMutation({
    mutationFn: async () => {
      await postAuthSessionAction("/api/auth/revoke-sessions");
    },
    onSuccess: async () => {
      toastManager.add({
        title: "All devices signed out",
        description: "This account has been signed out everywhere.",
        type: "success",
      });
      await queryClient.invalidateQueries({ queryKey: authSessionsQueryKey() });
      await router.invalidate();
      await router.navigate({ to: "/" });
    },
    onError: (error) => {
      logClientError("settings.account.revoke_all_sessions", error);
      toastManager.add({
        title: "Unable to sign out all devices",
        description: parseApiErrorMessage(error, "Unable to sign out all devices. Try again."),
        type: "error",
      });
    },
  });

  const fallbackSession: SessionRow[] = session?.session
    ? [
        {
          id: session.session.id,
          userAgent: session.session.userAgent ?? null,
          ipAddress: session.session.ipAddress ?? null,
          locationLabel: session.session.locationLabel ?? null,
          locationCity: session.session.locationCity ?? null,
          locationRegion: session.session.locationRegion ?? null,
          locationCountry: session.session.locationCountry ?? null,
          updatedAt: normalizeTimestamp(session.session.updatedAt),
          expiresAt: normalizeTimestamp(session.session.expiresAt),
          isCurrent: true,
        },
      ]
    : [];

  const fetchedSessions = sessionsData ?? [];
  const sessions =
    fetchedSessions.length > 0
      ? fetchedSessions.map((item) => ({
          ...item,
          isCurrent: session?.session?.id === item.id,
        }))
      : fallbackSession;

  const otherSessionCount = sessions.filter((item) => !item.isCurrent).length;

  const handleStartEditEmail = () => {
    setIsEditingEmail(true);
  };

  const handleCancelEditEmail = () => {
    setIsEditingEmail(false);
  };

  const handleRevokeOtherSessions = async () => {
    await revokeOtherSessionsMutation.mutateAsync();
  };

  const handleRevokeAllSessions = async () => {
    await revokeAllSessionsMutation.mutateAsync();
  };

  return {
    describeSessionDevice,
    describeSessionLocation,
    formatTimestamp,
    handleCancelEditEmail,
    handleRevokeAllSessions,
    handleRevokeOtherSessions,
    handleStartEditEmail,
    isEditingEmail,
    isSessionsError,
    otherSessionCount,
    revokeAllSessionsMutation,
    revokeOtherSessionsMutation,
    sessions,
  };
}
