"use client";

import { User3Fill } from "@mingcute/react";
import { useAuth } from "@/integrations/better-auth/auth-provider";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { SidebarMenuButton, SidebarMenuItem } from "@components/ui/sidebar";

export const accountSection = {
  description: "Manage your account details, connected accounts, and security settings.",
  icon: User3Fill,
  name: "Account",
} as const;

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
  const { user } = useAuth();

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40">
              <accountSection.icon className="size-5" />
            </div>
            <div className="min-w-0">
              <CardTitle>{accountSection.name}</CardTitle>
              <CardDescription className="mt-1">{accountSection.description}</CardDescription>
              {user?.email ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Signed in as</span>
                  <Badge size="lg" variant="outline">
                    {user.email}
                  </Badge>
                </div>
              ) : null}
            </div>
          </div>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preferences</CardTitle>
          <CardDescription>Account settings content will be added here.</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Session</CardTitle>
          <CardDescription>Sign out of your current session.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Button onClick={() => void onLogout()} variant="outline">
            Log out
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
