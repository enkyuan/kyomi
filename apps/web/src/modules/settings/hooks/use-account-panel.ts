"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { updateUserEmail } from "@lib/auth-functions";
import { toastManager } from "@vols.rss/ui/toast";
import {
  isValidEmail,
  normalizeTimestamp,
  parseApiErrorMessage,
  parseSessionsResponse,
  type SessionRow,
} from "../account-helpers";

type UseAccountPanelArgs = {
  session:
    | {
        session?: {
          expiresAt: string | Date;
          id: string;
          ipAddress?: string | null;
          updatedAt: string | Date;
          userAgent?: string | null;
        };
      }
    | null
    | undefined;
  user: { email?: string | null } | null | undefined;
};

export function useAccountPanel({ user, session }: UseAccountPanelArgs) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(user?.email ?? "");
  const [emailError, setEmailError] = useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: async (): Promise<SessionRow[]> => {
      const response = await fetch("/api/auth/list-sessions", {
        credentials: "include",
        method: "GET",
      });
      if (!response.ok) {
        throw new Error("Unable to load sessions.");
      }
      const data: unknown = await response.json();
      return parseSessionsResponse(data);
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] }),
        router.invalidate(),
      ]);
    },
    onError: (error) => {
      const message = parseApiErrorMessage(error);
      setEmailError(message);
      toastManager.add({
        title: "Unable to update email",
        description: message,
        type: "error",
      });
    },
  });

  useEffect(() => {
    if (!isEditingEmail) {
      setEmailDraft(user?.email ?? "");
      setEmailError(null);
    }
  }, [isEditingEmail, user?.email]);

  const fallbackSession: SessionRow[] = session?.session
    ? [
        {
          id: session.session.id,
          userAgent: session.session.userAgent ?? null,
          ipAddress: session.session.ipAddress ?? null,
          updatedAt: normalizeTimestamp(session.session.updatedAt),
          expiresAt: normalizeTimestamp(session.session.expiresAt),
          isCurrent: true,
        },
      ]
    : [];

  const fetchedSessions = sessionsQuery.data ?? [];
  const sessions =
    fetchedSessions.length > 0
      ? fetchedSessions.map((item) => ({
          ...item,
          isCurrent: session?.session?.id === item.id,
        }))
      : fallbackSession;

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

  return {
    emailDraft,
    emailError,
    isEditingEmail,
    sessions,
    sessionsQuery,
    updateEmailMutation,
    handleCancelEditEmail,
    handleEmailDraftChange,
    handleSaveEmail,
    handleStartEditEmail,
  };
}
