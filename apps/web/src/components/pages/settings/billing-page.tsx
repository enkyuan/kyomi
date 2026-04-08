"use client";

import { PhoneFill, BillFill } from "@mingcute/react";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { SidebarMenuButton, SidebarMenuItem } from "@components/ui/sidebar";

export const billingSection = {
  description: "Review your workspace plan, payment method, and billing history.",
  icon: BillFill,
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
        <billingSection.icon />
        <span>{billingSection.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

const billingSummary = [
  { label: "Plan", value: "Starter" },
  { label: "Renewal", value: "Monthly" },
  { label: "Seats", value: "1 active user" },
] as const;

export function BillingPagePanel() {
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40">
              <billingSection.icon className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{billingSection.name}</CardTitle>
                <Badge variant="outline">Starter</Badge>
              </div>
              <CardDescription className="mt-1">{billingSection.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Current plan</CardTitle>
          <CardDescription>
            Upgrade hooks can be connected here once billing is wired to a provider.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-0 sm:grid-cols-3">
          {billingSummary.map((item) => (
            <div key={item.label} className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">{item.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Payment method</CardTitle>
          <CardDescription>
            No payment source is connected yet. Add your billing integration to manage cards,
            invoices, and renewals here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 pt-0">
          <Badge variant="secondary">No card on file</Badge>
          <Button disabled variant="outline">
            Add payment method
          </Button>
          <Button disabled variant="ghost">
            View invoices
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Support</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PhoneFill className="size-4 shrink-0" />
            <span>
              Need a custom billing flow or invoice support? Surface it from the sidebar support
              entry.
            </span>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
