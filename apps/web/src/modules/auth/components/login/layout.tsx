import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AccountHeader } from "../account-header";

export function AccountLayout({
  children,
  onBack,
  register,
  redirect,
}: {
  children: ReactNode;
  onBack?: () => void;
  register: boolean;
  redirect?: string;
}) {
  return (
    <main className="relative grid min-h-dvh place-items-center px-6 py-24">
      <AccountHeader onBack={onBack} />
      <section className="w-full max-w-sm space-y-7">
        {children}
        {!onBack && (
          <p className="text-sm text-muted-foreground">
            {register ? "Already have an account? " : "New to Kyomi? "}
            <Link
              to={register ? "/" : "/register"}
              search={{ redirect }}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}

export function AccountHeading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <header className="space-y-2">
      <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
      <p className="text-sm leading-relaxed text-muted-foreground wrap-break-word">{children}</p>
    </header>
  );
}
