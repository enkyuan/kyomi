"use client";

import { Bill2Fill } from "@kyomi/ui/icons/mingcute";
import { Button } from "@kyomi/ui/atoms/button";
import { SidebarMenuButton, SidebarMenuItem } from "@kyomi/ui/atoms/sidebar";

export const billingSection = {
  description: "Review your workspace plan, payment method, and billing history.",
  name: "Billing",
} as const;

type BillingPageNavProps = {
  isActive: boolean;
  onSelect: () => void;
};

export function BillingPageNav({ isActive, onSelect }: BillingPageNavProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} onClick={onSelect}>
        <Bill2Fill />
        <span>{billingSection.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function BillingPagePanel() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{billingSection.name}</h3>
          <p className="text-sm text-muted-foreground">{billingSection.description}</p>
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
    </div>
  );
}
