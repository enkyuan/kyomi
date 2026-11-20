"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { prefetchInboxFlow } from "@modules/inbox/lib/navigation";
import { useAuth } from "@integrations/better-auth/provider";
import { Spinner } from "@kyomi/ui/components/spinner";
import { resolveAuthReturnTo } from "@modules/auth/redirect";
import { EmailStep } from "./email-step";
import { useEmailForm } from "./hooks";
import { AccountLayout } from "./layout";
import { OtpStep } from "./otp-step";

export function Login({ redirect, register = false }: { redirect?: string; register?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isPending } = useAuth();
  const returnTo = resolveAuthReturnTo(redirect);

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");

  const emailForm = useEmailForm((sentTo) => {
    setEmail(sentTo);
    setStep("otp");
  });

  useEffect(() => {
    if (!isPending && isAuthenticated) {
      void prefetchInboxFlow(router, queryClient).finally(() => {
        void router.navigate({ href: returnTo });
      });
    }
  }, [isAuthenticated, isPending, queryClient, returnTo, router]);

  if (isPending) {
    return (
      <main className="flex min-h-dvh w-full items-center justify-center px-4 py-12">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Spinner className="size-4" />
          <span>Loading…</span>
        </div>
      </main>
    );
  }

  return (
    <AccountLayout
      register={register}
      redirect={redirect}
      onBack={step === "otp" ? () => setStep("email") : undefined}
    >
      {step === "email" ? (
        <EmailStep emailForm={emailForm} register={register} />
      ) : (
        <OtpStep email={email} returnTo={returnTo} />
      )}
    </AccountLayout>
  );
}
