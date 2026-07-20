"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { updateUserEmail } from "@lib/auth/functions";
import { logClientError, readResponseErrorSummary } from "@lib/errors";
import { isValidEmail } from "@modules/auth/schema";
import { toastManager } from "@kyomi/ui/toast";
import {
  authSessionsQueryKey,
  parseApiErrorMessage,
  parseSessionsResponse,
  postAuthSessionAction,
} from "./session/api";
import { describeSessionDevice } from "./session/device";
import { formatTimestamp, normalizeTimestamp } from "./session/format";
import { describeSessionLocation } from "./session/location";
import type { SessionRow, UseAccountPanelArgs } from "./session/types";

export function useAccountPanel({ user, session }: UseAccountPanelArgs) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(user?.email ?? "");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [prevUserEmail, setPrevUserEmail] = useState(user?.email);

  if (!isEditingEmail && user?.email !== prevUserEmail) {
    setPrevUserEmail(user?.email);
    setEmailDraft(user?.email ?? "");
  }

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

  const updateEmailMutation = useMutation({
    mutationFn: async (email: string) => updateUserEmail({ data: { email } }),
    onSuccess: async (updatedProfile) => {
      setIsEditingEmail(false);
      setEmailError(null);
      setEmailDraft(updatedProfile.email);
      toastManager.add({
        title: "Email updated",
        type: "success",
      });
      await queryClient.invalidateQueries({ queryKey: authSessionsQueryKey() });
      await router.invalidate();
    },
    onError: (error) => {
      logClientError("settings.account.email", error);
      const message = parseApiErrorMessage(error, "Unable to update email. Try again.");
      setEmailError(message);
      toastManager.add({
        title: "Unable to update email",
        type: "error",
      });
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (token: string) => {
      await postAuthSessionAction("/api/auth/revoke-session", { token });
    },
    onSuccess: async () => {
      toastManager.add({
        title: "Session signed out",
        type: "success",
      });
      await queryClient.invalidateQueries({ queryKey: authSessionsQueryKey() });
      await router.invalidate();
    },
    onError: (error) => {
      logClientError("settings.account.revoke_session", error);
      toastManager.add({
        title: "Unable to sign out session",
        type: "error",
      });
    },
  });

  const revokeOtherSessionsMutation = useMutation({
    mutationFn: async () => {
      await postAuthSessionAction("/api/auth/revoke-other-sessions");
    },
    onSuccess: async () => {
      toastManager.add({
        title: "Other sessions signed out",
        type: "success",
      });
      await queryClient.invalidateQueries({ queryKey: authSessionsQueryKey() });
      await router.invalidate();
    },
    onError: (error) => {
      logClientError("settings.account.revoke_other_sessions", error);
      toastManager.add({
        title: "Unable to sign out other sessions",
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
        type: "error",
      });
    },
  });

  const fallbackSession: SessionRow[] = session?.session
    ? [
        {
          id: session.session.id,
          token: session.session.token,
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
    setEmailDraft(user?.email ?? "");
    setEmailError(null);
  };

  const handleCancelEditEmail = () => {
    setIsEditingEmail(false);
    setEmailDraft(user?.email ?? "");
    setEmailError(null);
  };

  const handleEmailDraftChange = (nextValue: string) => {
    setEmailDraft(nextValue);
    if (emailError) {
      setEmailError(null);
    }
  };

  const handleSaveEmail = async () => {
    const trimmedEmail = emailDraft.trim();

    if (!isValidEmail(trimmedEmail)) {
      setEmailError("Enter a valid email address.");
      return;
    }

    if (trimmedEmail === (user?.email ?? "")) {
      setIsEditingEmail(false);
      setEmailError(null);
      return;
    }

    setEmailError(null);
    await updateEmailMutation.mutateAsync(trimmedEmail);
  };

  const handleRevokeSession = async (token: string) => {
    await revokeSessionMutation.mutateAsync(token);
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
    emailDraft,
    emailError,
    formatTimestamp,
    handleCancelEditEmail,
    handleEmailDraftChange,
    handleRevokeAllSessions,
    handleRevokeOtherSessions,
    handleRevokeSession,
    handleSaveEmail,
    handleStartEditEmail,
    isEditingEmail,
    isSessionsError,
    otherSessionCount,
    revokeAllSessionsMutation,
    revokeOtherSessionsMutation,
    revokeSessionMutation,
    sessions,
    updateEmailMutation,
  };
}
