"use client";

import { CheckFill, CloseFill, Edit2Fill, User3Fill } from "@kyomi/ui/icons/mingcute";
import { useAuth } from "@integrations/better-auth/provider";
import { Badge } from "@kyomi/ui/badge";
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
import { useAccountPanel } from "@modules/settings/hooks/account";
import { SettingHeading } from "../appearance/shared";

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
    describeSessionDevice,
    describeSessionLocation,
    emailDraft,
    emailError,
    formatTimestamp,
    handleCancelEditEmail,
    handleEmailDraftChange,
    handleRevokeAllSessions,
    handleRevokeOtherSessions,
    handleSaveEmail,
    handleStartEditEmail,
    isEditingEmail,
    isSessionsError,
    otherSessionCount,
    revokeAllSessionsMutation,
    revokeOtherSessionsMutation,
    sessions,
    updateEmailMutation,
  } = useAccountPanel({ user, session });

  return (
    <div className={ACCOUNT_SUBSECTION_SPACING_CLASS}>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">Account</h3>
          <Button size="sm" variant="destructive-outline" onClick={() => void onLogout()}>
            Log out
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SettingHeading title="Email" description="Manage your account email address." />
          <div className="flex items-center gap-2">
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
      </section>

      <section className="space-y-3">
        <SettingHeading title="Session" description="Manage active sessions for this account." />
        <Frame className="w-full pb-0">
          <Table variant="card">
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>IP address</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead className="text-right">Expires</TableHead>
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
                    <TableCell
                      className="max-w-80 truncate"
                      title={describeSessionDevice(sessionItem.userAgent).fullUserAgent}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-sm">
                          {describeSessionDevice(sessionItem.userAgent).label}
                        </span>
                        {sessionItem.isCurrent ? (
                          <Badge
                            size="sm"
                            className="text-petrol-green bg-petrol-green/20 border-transparent font-semibold tracking-wider"
                          >
                            Current
                          </Badge>
                        ) : null}
                      </div>
                      <span className="block text-xs text-muted-foreground truncate max-w-72 mt-0.5">
                        {describeSessionDevice(sessionItem.userAgent).meta}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {describeSessionLocation(sessionItem)}
                    </TableCell>
                    <TableCell>{sessionItem.ipAddress || "Unknown"}</TableCell>
                    <TableCell>{formatTimestamp(sessionItem.updatedAt).relative}</TableCell>
                    <TableCell className="text-right">
                      {formatTimestamp(sessionItem.expiresAt).absolute}
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

        <div className="flex flex-wrap items-center gap-3">
          {otherSessionCount > 0 ? (
            <Button
              loading={revokeOtherSessionsMutation.isPending}
              onClick={() => void handleRevokeOtherSessions()}
              variant="outline"
              size="sm"
            >
              Sign out other devices
            </Button>
          ) : null}
          <Button
            loading={revokeAllSessionsMutation.isPending}
            onClick={() => void handleRevokeAllSessions()}
            variant="destructive-outline"
            size="sm"
          >
            Sign out of all devices
          </Button>
        </div>
      </section>
    </div>
  );
}
