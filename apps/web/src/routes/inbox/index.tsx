import { useEffect } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/integrations/better-auth/auth-provider";

function InboxPage() {
  const { isAuthenticated, isPending } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !isAuthenticated) {
      void router.navigate({ to: "/" });
    }
  }, [isAuthenticated, isPending, router]);

  if (isPending) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-card-foreground shadow-xs/5">
          <p className="text-sm text-muted-foreground">Checking session…</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-card-foreground shadow-xs/5">
        <h1 className="text-xl font-semibold">You’re signed in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Authentication is configured with Better Auth and Drizzle.
        </p>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/inbox/")({
  component: InboxPage,
});
