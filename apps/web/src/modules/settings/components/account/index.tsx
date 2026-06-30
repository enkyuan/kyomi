"use client";

import { CheckFill, CloseFill, Edit2Fill, User3Fill } from "@mingcute/react";
import { useAuth } from "@integrations/better-auth/provider";
import { Button } from "@kyomi/ui/button";
import { Frame } from "@kyomi/ui/frame";
import { Group } from "@kyomi/ui/group";
import { Input } from "@kyomi/ui/input";
import { SidebarMenuButton, SidebarMenuItem } from "@kyomi/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@kyomi/ui/table";
import { useAccountPanel } from "@modules/settings/hooks/use-account-panel";

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

export function AccountPagePanel({ onLogout }: AccountPagePanelProps) {
  const { user, session } = useAuth();
  const {
    emailDraft,
    emailError,
    formatTimestamp,
    isEditingEmail,
    sessions,
    isSessionsError,
    shortenUserAgent,
    updateEmailMutation,
    handleCancelEditEmail,
    handleEmailDraftChange,
    handleSaveEmail,
    handleStartEditEmail,
  } = useAccountPanel({ user, session });

  return (
    <div className={ACCOUNT_SUBSECTION_SPACING_CLASS}>
      <section className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Email</span>
            <div className="ms-auto flex items-center gap-2">
              {isEditingEmail ? (
                <Group aria-label="Email subscription" className="gap-2">
                  <Input
                    className="flex-1"
                    aria-label="Email"
                    aria-invalid={emailError ? true : undefined}
                    onChange={(event) => {
                      handleEmailDraftChange(event.target.value);
                    }}
                    placeholder="you@example.com"
                    type="email"
                    value={emailDraft}
                  />
                  <div>
                    <Button
                      loading={updateEmailMutation.isPending}
                      onClick={() => void handleSaveEmail()}
                      size="icon"
                      variant="outline"
                    >
                      <CheckFill />
                    </Button>
                  </div>
                  <div>
                    <Button
                      disabled={updateEmailMutation.isPending}
                      onClick={handleCancelEditEmail}
                      size="icon"
                      variant="destructive-outline"
                    >
                      <CloseFill />
                    </Button>
                  </div>
                </Group>
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
                    <TableCell>{sessionItem.ipAddress || "Unknown"}</TableCell>
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
        {isSessionsError ? (
          <p className="text-sm text-muted-foreground">Unable to load all sessions right now.</p>
        ) : null}
        <Button onClick={() => void onLogout()} variant="destructive-outline">
          Log out
        </Button>
      </section>
    </div>
  );
}
