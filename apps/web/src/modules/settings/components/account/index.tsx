"use client";

import { EditIcon, UserIcon } from "@kyomi/ui/icons/blode";
import { useAuth } from "@integrations/better-auth/provider";
import { Badge } from "@kyomi/ui/components/badge";
import { Button } from "@kyomi/ui/components/button";
import { Frame } from "@kyomi/ui/components/frame";
import { SidebarMenuButton, SidebarMenuItem } from "@kyomi/ui/components/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@kyomi/ui/components/table";
import { useAccountPanel } from "@modules/settings/hooks/use-account-panel";
import { SettingHeading } from "../appearance/headings";
import { EmailDialog } from "./email-dialog";

/** The flat destructive action: the secondary token fill with a tinted hover, no tactile shadow. */
const DESTRUCTIVE_FLAT_CLASS =
  "text-destructive hover:bg-destructive/10 data-pressed:bg-destructive/10";

const accountSection = {
  description: "Manage your account details, connected accounts, and security settings.",
  icon: UserIcon,
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
        <UserIcon />
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
  } = useAccountPanel({ session });

  return (
    <div className={ACCOUNT_SUBSECTION_SPACING_CLASS}>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-foreground text-xl leading-8">Account</h2>
          <Button
            className={DESTRUCTIVE_FLAT_CLASS}
            shape="pill"
            size="sm"
            variant="secondary"
            onClick={() => void onLogout()}
          >
            Log out
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SettingHeading title="Email" description="Manage your account email address." />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{user?.email ?? "Unknown email"}</span>
            <Button
              aria-label="Edit email"
              onClick={handleStartEditEmail}
              shape="pill"
              size="icon-xs"
              variant="ghost"
            >
              <EditIcon />
            </Button>
          </div>
        </div>
        {user?.email ? (
          <EmailDialog
            currentEmail={user.email}
            onOpenChange={(open) => {
              if (!open) {
                handleCancelEditEmail();
              }
            }}
            open={isEditingEmail}
          />
        ) : null}
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
                            className="font-semibold tracking-wider"
                            size="sm"
                            variant="success"
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
              shape="pill"
              variant="secondary"
              size="sm"
            >
              Sign out other devices
            </Button>
          ) : null}
          <Button
            className={DESTRUCTIVE_FLAT_CLASS}
            loading={revokeAllSessionsMutation.isPending}
            onClick={() => void handleRevokeAllSessions()}
            shape="pill"
            variant="secondary"
            size="sm"
          >
            Sign out of all devices
          </Button>
        </div>
      </section>
    </div>
  );
}
