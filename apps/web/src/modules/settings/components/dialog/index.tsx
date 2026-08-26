"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@kyomi/ui/dialog";
import { useSettingsLogout } from "@modules/settings/hooks/logout";
import { SettingsDialogRoutes } from "./routes";

type SettingsDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { logout } = useSettingsLogout({ onOpenChange });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
       * Intentionally static at `md:` and stops there — this is a fixed-content settings form,
       * not a content-scaling surface, so it does not grow further at `2xl`/`3xl`/`4xl` the way
       * the app shell (apps/web/src/app/app-shell.tsx) does. Do not re-flag this in a future
       * responsive audit.
       */}
      <DialogContent className="overflow-hidden p-0 md:max-h-135 md:max-w-205">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">Configure workspace settings.</DialogDescription>
        <SettingsDialogRoutes logout={logout} />
      </DialogContent>
    </Dialog>
  );
}
