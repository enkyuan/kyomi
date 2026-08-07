import type React from "react";
import { Button } from "@kyomi/ui/atoms/button";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@kyomi/ui/atoms/card";
import { GoogleFill } from "@kyomi/ui/icons/mingcute";
import { Separator } from "@kyomi/ui/atoms/separator";
import { Spinner } from "@kyomi/ui/atoms/spinner";

export function AuthLoading() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center px-4 py-12">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Spinner className="size-4" />
        <span>Loading…</span>
      </div>
    </main>
  );
}

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center px-4 py-8 sm:py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardPanel>
          <div className="flex flex-col gap-5">
            {children}
            {footer ? <p className="text-center text-muted-foreground text-sm">{footer}</p> : null}
          </div>
        </CardPanel>
      </Card>
    </main>
  );
}

export function GoogleAuthButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <Button className="w-full" loading={loading} onClick={onClick} type="button" variant="outline">
      <GoogleFill aria-hidden="true" />
      Continue with Google
    </Button>
  );
}

export function AuthDivider() {
  return (
    <div aria-hidden="true" className="flex items-center gap-3">
      <Separator className="flex-1" />
      <span className="shrink-0 text-muted-foreground text-xs">or</span>
      <Separator className="flex-1" />
    </div>
  );
}

export const authLinkClassName =
  "font-medium text-foreground underline-offset-4 hover:text-foreground/80 hover:underline";
