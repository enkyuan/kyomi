"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@kyomi/ui/components/dialog";
import { useSettingsLogout } from "@modules/settings/hooks/use-logout";
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
       * Scaled up from 820x540 (about 1.17x) so the sessions table fits without a horizontal
       * scrollbar. Static at `md:` and does not grow at `2xl` and up like the app shell
       * (apps/web/src/app/shell.tsx): this is a fixed-content form. The popup's own `max-h-full`
       * shrinks it on short viewports. It has no close button: Escape and a click on the
       * backdrop dismiss it.
       */}
      <DialogContent className="overflow-hidden p-0 md:h-160 md:max-w-240" showCloseButton={false}>
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">Configure workspace settings.</DialogDescription>
        <SettingsDialogRoutes logout={logout} />
      </DialogContent>
    </Dialog>
  );
}
