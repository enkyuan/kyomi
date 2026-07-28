"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@kyomi/ui/atoms/dialog";
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
      <DialogContent className="overflow-hidden p-0 md:max-h-135 md:max-w-205">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">Configure workspace settings.</DialogDescription>
        <SettingsDialogRoutes logout={logout} />
      </DialogContent>
    </Dialog>
  );
}
