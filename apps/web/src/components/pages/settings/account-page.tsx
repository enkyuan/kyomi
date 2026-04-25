"use client";

import { useEffect, useState } from "react";
import { Edit2Fill, User3Fill } from "@mingcute/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { updateUserEmail } from "@lib/auth-functions";
import { useAuth } from "@integrations/better-auth/auth-provider";
import { Button } from "@components/ui/button";
import { Frame } from "@components/ui/frame";
import { Input } from "@components/ui/input";
import { SidebarMenuButton, SidebarMenuItem } from "@components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@components/ui/table";
import { toastManager } from "@components/ui/toast";

export const accountSection = {
  description: "Manage your account details, connected accounts, and security settings.",
  icon: User3Fill,
  name: "Account",
} as const;

const ACCOUNT_SUBSECTION_SPACING_CLASS = "space-y-8";

type AccountPageNavProps = {
  isActive: boolean;
  onSelect: () => void;
};

export function AccountPageNav({ isActive, onSelect }: AccountPageNavProps) {
  const { user } = useAuth();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={onSelect}
        tooltip={user?.email || accountSection.name}
      >
        <User3Fill />
        <span>{accountSection.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

type AccountPagePanelProps = {
  onLogout: () => Promise<void>;
};

type SessionRow = {
  expiresAt: string;
  id: string;
  ipAddress: string | null;
  isCurrent: boolean;
  updatedAt: string;
  userAgent: string | null;
};

function parseSessionsResponse(value: unknown): SessionRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sessions: SessionRow[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    const userAgent = typeof record.userAgent === "string" ? record.userAgent : null;
    const ipAddress = typeof record.ipAddress === "string" ? record.ipAddress : null;
    const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt : "";
    const expiresAt = typeof record.expiresAt === "string" ? record.expiresAt : "";

    if (!id || !updatedAt || !expiresAt) continue;

    sessions.push({
      id,
      userAgent,
      ipAddress,
      updatedAt,
      expiresAt,
      isCurrent: false,
    });
  }

  return sessions;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function shortenUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const normalized = userAgent.trim();
  if (!normalized) return "Unknown device";
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

function normalizeTimestamp(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function parseApiErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as { error?: { message?: string } };
      if (parsed?.error?.message) {
        return parsed.error.message;
      }
    } catch {
      // Fallback to raw error message.
    }
    return error.message || "Unable to update email.";
  }
  return "Unable to update email.";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function AccountPagePanel({ onLogout }: AccountPagePanelProps) {
  const { user, session } = useAuth();
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

  return (
    <div className={ACCOUNT_SUBSECTION_SPACING_CLASS}>
      <section className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Email</span>
            <div className="ms-auto flex items-center gap-2">
              {isEditingEmail ? (
                <>
                  <Input
                    className="w-72 max-w-full"
                    aria-invalid={emailError ? true : undefined}
                    onChange={(event) => {
                      setEmailDraft(event.target.value);
                      if (emailError) {
                        setEmailError(null);
                      }
                    }}
                    placeholder="you@example.com"
                    type="email"
                    value={emailDraft}
                  />
                  <Button
                    loading={updateEmailMutation.isPending}
                    onClick={() => void handleSaveEmail()}
                    size="sm"
                    variant="outline"
                  >
                    Save
                  </Button>
                  <Button
                    disabled={updateEmailMutation.isPending}
                    onClick={handleCancelEditEmail}
                    size="sm"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground">
                    {user?.email ?? "Unknown email"}
                  </span>
                  <Button
                    aria-label="Edit email"
                    onClick={handleStartEditEmail}
                    size="icon-xs"
                    variant="ghost"
                  >
                    <Edit2Fill />
                  </Button>
                </>
              )}
            </div>
          </div>
          {emailError ? <p className="text-sm text-destructive">{emailError}</p> : null}
        </div>
      </section>
      <section className="space-y-1">
        <h3 className="text-sm font-semibold">Preferences</h3>
        <p className="text-sm text-muted-foreground">
          Account settings content will be added here.
        </p>
      </section>
      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Billing</h3>
          <p className="text-sm text-muted-foreground">
            Review your workspace plan, payment method, and billing history.
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Basic</span>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline">Upgrade Plan</Button>
            </div>
          </div>
        </div>
      </section>
      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Session</h3>
          <p className="text-sm text-muted-foreground">Manage active sessions for this account.</p>
        </div>
        <Frame className="w-full">
          <Table variant="card">
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>IP address</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={5}>
                    No active sessions found.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((sessionItem) => (
                  <TableRow key={sessionItem.id}>
                    <TableCell className="max-w-80 truncate">
                      {shortenUserAgent(sessionItem.userAgent)}
                    </TableCell>
                    <TableCell>{sessionItem.ipAddress ?? "Unknown"}</TableCell>
                    <TableCell>{formatTimestamp(sessionItem.updatedAt)}</TableCell>
                    <TableCell>{formatTimestamp(sessionItem.expiresAt)}</TableCell>
                    <TableCell className="text-right">
                      {sessionItem.isCurrent ? (
                        <span className="inline-flex items-center justify-end">
                          <span className="relative inline-flex size-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/64" />
                            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                          </span>
                          <span className="sr-only">Current session</span>
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4}>Total Sessions</TableCell>
                <TableCell className="text-right">{sessions.length}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Frame>
        {sessionsQuery.isError ? (
          <p className="text-sm text-muted-foreground">Unable to load all sessions right now.</p>
        ) : null}
        <Button onClick={() => void onLogout()} variant="destructive-outline">
          Log out
        </Button>
      </section>
    </div>
  );
}
