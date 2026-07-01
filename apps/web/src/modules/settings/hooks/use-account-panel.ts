"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { updateUserEmail } from "@lib/auth/functions";
import { getUserSafeErrorMessage, logClientError, readResponseErrorSummary } from "@lib/errors";
import { authSessionListSchema } from "@lib/schemas";
import { isValidEmail } from "@modules/auth/schema";
import { toastManager } from "@kyomi/ui/toast";

type SessionRow = {
  expiresAt: string;
  id: string;
  ipAddress: string | null;
  isCurrent: boolean;
  locationCity: string | null;
  locationCountry: string | null;
  locationLabel: string | null;
  locationRegion: string | null;
  token: string;
  updatedAt: string;
  userAgent: string | null;
};

type FormattedTimestamp = {
  absolute: string;
  relative: string;
};

type SessionDevice = {
  fullUserAgent: string;
  label: string;
  meta: string;
};

type UseAccountPanelArgs = {
  session:
    | {
        session?: {
          expiresAt: string | Date;
          id: string;
          ipAddress?: string | null;
          locationCity?: string | null;
          locationCountry?: string | null;
          locationLabel?: string | null;
          locationRegion?: string | null;
          token: string;
          updatedAt: string | Date;
          userAgent?: string | null;
        };
      }
    | null
    | undefined;
  user: { email?: string | null } | null | undefined;
};

function parseSessionsResponse(value: unknown): SessionRow[] {
  return authSessionListSchema.parse(value).map((session) => ({
    ...session,
    isCurrent: false,
  }));
}

function normalizeTimestamp(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function parseApiErrorMessage(error: unknown, fallback = "Request failed. Try again."): string {
  return getUserSafeErrorMessage(error, fallback);
}

const accountTimestampFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});
const accountRelativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function formatRelativeTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  const absMinutes = Math.abs(diffMinutes);

  if (absMinutes < 1) {
    return "just now";
  }

  if (absMinutes < 60) {
    return accountRelativeFormatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  const absHours = Math.abs(diffHours);
  if (absHours < 24) {
    return accountRelativeFormatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  const absDays = Math.abs(diffDays);
  if (absDays < 7) {
    return accountRelativeFormatter.format(diffDays, "day");
  }

  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffWeeks) < 5) {
    return accountRelativeFormatter.format(diffWeeks, "week");
  }

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return accountRelativeFormatter.format(diffMonths, "month");
  }

  const diffYears = Math.round(diffDays / 365);
  return accountRelativeFormatter.format(diffYears, "year");
}

function formatTimestamp(value: string): FormattedTimestamp {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { absolute: "Unknown", relative: "Unknown" };
  }

  return {
    absolute: accountTimestampFormatter.format(date),
    relative: formatRelativeTimestamp(value),
  };
}

function detectBrowser(userAgent: string) {
  if (/Firefox\//i.test(userAgent)) return "Firefox";
  if (/Edg\//i.test(userAgent)) return "Edge";
  if (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)) return "Chrome";
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return "Safari";
  return "Browser";
}

function detectOs(userAgent: string) {
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Android/i.test(userAgent)) return "Android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iPhone";
  if (/Mac OS X|Macintosh/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "Unknown OS";
}

function describeSessionDevice(userAgent: string | null): SessionDevice {
  if (!userAgent) {
    return {
      fullUserAgent: "Unknown user agent",
      label: "Unknown device",
      meta: "No device details available",
    };
  }

  const normalized = userAgent.trim();
  if (!normalized) {
    return {
      fullUserAgent: "Unknown user agent",
      label: "Unknown device",
      meta: "No device details available",
    };
  }

  const browser = detectBrowser(normalized);
  const os = detectOs(normalized);

  return {
    fullUserAgent: normalized,
    label: `${browser} on ${os}`,
    meta: normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized,
  };
}

function describeSessionLocation(session: Pick<SessionRow, "locationLabel" | "ipAddress">) {
  if (session.locationLabel) {
    return session.locationLabel;
  }

  if (session.ipAddress === "127.0.0.1" || session.ipAddress === "::1") {
    return "Localhost";
  }

  return "Unknown";
}

function authSessionsQueryKey() {
  return ["auth", "sessions"] as const;
}

async function postAuthSessionAction(path: string, body?: Record<string, string>) {
  const response = await fetch(path, {
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
    headers: body ? { "content-type": "application/json" } : undefined,
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readResponseErrorSummary(response));
  }

  const data = (await response.json()) as { status?: boolean };
  if (!data.status) {
    throw new Error("Session action was not confirmed.");
  }
}

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
        description: updatedProfile.email,
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
        description: message,
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
        description: "The selected device no longer has access.",
        type: "success",
      });
      await queryClient.invalidateQueries({ queryKey: authSessionsQueryKey() });
      await router.invalidate();
    },
    onError: (error) => {
      logClientError("settings.account.revoke_session", error);
      toastManager.add({
        title: "Unable to sign out session",
        description: parseApiErrorMessage(error, "Unable to sign out that session. Try again."),
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
