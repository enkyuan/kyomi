"use client";

import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { authClient } from "@lib/auth/client";
import { getUserSafeErrorMessage, logClientError } from "@kyomi/reader/lib/errors";
import { prefetchInboxFlow } from "@modules/inbox";
import { useAuth } from "@integrations/better-auth/provider";
import { Button } from "@kyomi/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@kyomi/ui/card";
import { Form } from "@kyomi/ui/form";
import { Field, FieldError, FieldLabel } from "@kyomi/ui/field";
import { Input } from "@kyomi/ui/input";
import { OTPField, OTPFieldInput, OTPFieldSeparator } from "@kyomi/ui/otp-field";
import { Spinner } from "@kyomi/ui/spinner";
import { toastManager } from "@kyomi/ui/toast";
import {
  emailOtpDefaultValues,
  emailOtpFormValidator,
  getFieldErrorMessage,
  otpDefaultValues,
  otpFormValidator,
} from "@modules/auth/schema";
import { resolveAuthReturnTo } from "@modules/auth/redirect";

export function Login({ redirect }: { redirect?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isPending } = useAuth();
  const returnTo = resolveAuthReturnTo(redirect);

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [isResending, setIsResending] = useState(false);

  const emailForm = useForm({
    defaultValues: emailOtpDefaultValues,
    validators: {
      onChange: emailOtpFormValidator,
      onSubmit: emailOtpFormValidator,
    },
    onSubmit: async ({ value }) => {
      await toastManager.promise(
        (async () => {
          const result = await authClient.emailOtp.sendVerificationOtp({
            email: value.email,
            type: "sign-in",
          });

          if (result.error) {
            throw new Error(result.error.message?.trim() || "Could not send sign-in code");
          }

          setEmail(value.email);
          setStep("otp");
        })(),
        {
          error: (error) => {
            logClientError("auth.send_otp", error);
            return {
              description: getUserSafeErrorMessage(error, "Could not send sign-in code"),
              title: "Error sending code",
              type: "error",
            };
          },
          loading: {
            description: "Sending sign-in code to your email.",
            timeout: 0,
            title: "Sending code…",
            type: "loading",
          },
          success: {
            description: "Check your email for the 6-digit code.",
            title: "Code sent",
            type: "success",
          },
        },
      );
    },
  });

  const otpForm = useForm({
    defaultValues: otpDefaultValues,
    validators: {
      onChange: otpFormValidator,
      onSubmit: otpFormValidator,
    },
    onSubmit: async ({ value }) => {
      await toastManager.promise(
        (async () => {
          const result = await authClient.signIn.emailOtp({
            email,
            otp: value.otp,
            callbackURL: returnTo,
          });

          if (result.error) {
            throw new Error(result.error.message?.trim() || "Invalid code");
          }

          await Promise.all([router.invalidate(), prefetchInboxFlow(router, queryClient)]);
          await router.navigate({ href: returnTo });
        })(),
        {
          error: (error) => {
            logClientError("auth.verify_otp", error);
            return {
              description: getUserSafeErrorMessage(error, "Invalid code"),
              title: "Verification failed",
              type: "error",
            };
          },
          loading: {
            description: "Verifying your sign-in code.",
            timeout: 0,
            title: "Verifying…",
            type: "loading",
          },
          success: {
            description: "Redirecting to your inbox.",
            title: "Logged in",
            type: "success",
          },
        },
      );
    },
  });

  const handleResendCode = async () => {
    if (!email || isResending) return;
    setIsResending(true);
    try {
      await toastManager.promise(
        (async () => {
          const result = await authClient.emailOtp.sendVerificationOtp({
            email,
            type: "sign-in",
          });

          if (result.error) {
            throw new Error(result.error.message?.trim() || "Could not resend code");
          }
        })(),
        {
          error: (error) => {
            logClientError("auth.resend_otp", error);
            return {
              description: getUserSafeErrorMessage(error, "Could not resend code"),
              title: "Resend failed",
              type: "error",
            };
          },
          loading: {
            description: "Sending a new code to your email.",
            timeout: 0,
            title: "Resending code…",
            type: "loading",
          },
          success: {
            description: "Check your email for the new code.",
            title: "Code sent",
            type: "success",
          },
        },
      );
    } finally {
      setIsResending(false);
    }
  };

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
    <main className="flex min-h-dvh w-full items-center justify-center px-4 py-12">
      <Card className="w-full max-w-xs">
        {step === "email" ? (
          <>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle>Sign in to Kyomi</CardTitle>
                <CardDescription>Enter your email to receive a sign-in code.</CardDescription>
              </div>
            </CardHeader>
            <CardPanel>
              <Form
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void emailForm.handleSubmit();
                }}
              >
                <emailForm.Field name="email">
                  {(field) => {
                    const canShow = field.state.meta.isTouched || field.form.state.isSubmitted;
                    const errorMessage = getFieldErrorMessage(field.state.meta.errors, canShow);

                    return (
                      <Field>
                        <FieldLabel>Email</FieldLabel>
                        <Input
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder="Enter your email"
                          type="email"
                          autoComplete="email"
                          autoFocus
                        />
                        {errorMessage ? (
                          <FieldError match={true}>{errorMessage as string}</FieldError>
                        ) : null}
                      </Field>
                    );
                  }}
                </emailForm.Field>

                <emailForm.Subscribe selector={(state) => [state.isSubmitting]}>
                  {([isSubmitting]) => (
                    <Button className="w-full" type="submit" loading={Boolean(isSubmitting)}>
                      {isSubmitting ? "Sending code…" : "Continue"}
                    </Button>
                  )}
                </emailForm.Subscribe>
              </Form>
            </CardPanel>
          </>
        ) : (
          <>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle>Enter verification code</CardTitle>
                <CardDescription>
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-foreground">{email}</span>.
                </CardDescription>
              </div>
              <CardAction>
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="text-foreground text-sm leading-4.5 hover:text-foreground/80 hover:underline cursor-pointer"
                >
                  Edit
                </button>
              </CardAction>
            </CardHeader>
            <CardPanel>
              <Form
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void otpForm.handleSubmit();
                }}
              >
                <otpForm.Field name="otp">
                  {(field) => {
                    const canShow = field.state.meta.isTouched || field.form.state.isSubmitted;
                    const errorMessage = getFieldErrorMessage(field.state.meta.errors, canShow);

                    return (
                      <Field className="items-center">
                        <FieldLabel className="sr-only">Verification code</FieldLabel>
                        <OTPField
                          aria-label="Verification code"
                          length={6}
                          value={field.state.value}
                          onValueChange={(val) => field.handleChange(val)}
                        >
                          <OTPFieldInput autoFocus />
                          <OTPFieldInput aria-label="Character 2 of 6" />
                          <OTPFieldInput aria-label="Character 3 of 6" />
                          <OTPFieldSeparator />
                          <OTPFieldInput aria-label="Character 4 of 6" />
                          <OTPFieldInput aria-label="Character 5 of 6" />
                          <OTPFieldInput aria-label="Character 6 of 6" />
                        </OTPField>
                        {errorMessage ? (
                          <FieldError match={true}>{errorMessage as string}</FieldError>
                        ) : null}
                      </Field>
                    );
                  }}
                </otpForm.Field>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="hover:text-foreground hover:underline transition-colors cursor-pointer"
                  >
                    Back to email
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleResendCode()}
                    disabled={isResending}
                    className="font-medium text-foreground hover:underline transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isResending ? "Resending…" : "Resend code"}
                  </button>
                </div>

                <otpForm.Subscribe selector={(state) => [state.isSubmitting]}>
                  {([isSubmitting]) => (
                    <Button className="w-full" type="submit" loading={Boolean(isSubmitting)}>
                      {isSubmitting ? "Verifying…" : "Continue"}
                    </Button>
                  )}
                </otpForm.Subscribe>
              </Form>
            </CardPanel>
          </>
        )}
      </Card>
    </main>
  );
}
