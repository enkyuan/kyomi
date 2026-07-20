"use client";

import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@integrations/better-auth/provider";
import { authClient } from "@lib/auth/client";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import { Button } from "@kyomi/ui/button";
import { Field, FieldError, FieldLabel } from "@kyomi/ui/field";
import { Form } from "@kyomi/ui/form";
import { Input } from "@kyomi/ui/input";
import { toastManager } from "@kyomi/ui/toast";
import {
  AuthCard,
  AuthDivider,
  AuthLoading,
  authLinkClassName,
  GoogleAuthButton,
} from "@modules/auth/components/auth-card";
import { PasswordField } from "@modules/auth/components/password-field";
import {
  buildAuthEntryHref,
  buildOAuthErrorHref,
  resolveAuthReturnTo,
} from "@modules/auth/redirect";
import { getFieldErrorMessage, loginDefaultValues, loginFormValidator } from "@modules/auth/schema";
import { prefetchInboxFlow } from "@modules/inbox";

type LoginProps = {
  redirect?: string;
  googleOAuthEnabled?: boolean;
  passwordResetEnabled?: boolean;
  authError?: "oauth";
};

export function Login({
  redirect,
  googleOAuthEnabled = false,
  passwordResetEnabled = false,
  authError,
}: LoginProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isPending } = useAuth();
  const returnTo = resolveAuthReturnTo(redirect);
  const [isGooglePending, setIsGooglePending] = useState(false);
  const form = useForm({
    defaultValues: loginDefaultValues,
    validators: {
      onChange: loginFormValidator,
      onSubmit: loginFormValidator,
    },
    onSubmit: async ({ value }) => {
      await toastManager.promise(
        (async () => {
          const result = await authClient.signIn.email({
            email: value.email,
            password: value.password,
            callbackURL: returnTo,
          });

          if (result.error) {
            throw new Error(result.error.message?.trim() || "Invalid email or password");
          }

          await Promise.all([router.invalidate(), prefetchInboxFlow(router, queryClient)]);
          await router.navigate({ href: returnTo });
        })(),
        {
          error: (error) => {
            logClientError("auth.login", error);
            return {
              title: getUserSafeErrorMessage(error, "Invalid email or password"),
              type: "error",
            };
          },
          loading: {
            timeout: 0,
            title: "Logging in…",
            type: "loading",
          },
          success: {
            title: "Logged in",
            type: "success",
          },
        },
      );
    },
  });

  useEffect(() => {
    if (!isPending && isAuthenticated) {
      void prefetchInboxFlow(router, queryClient).finally(() => {
        void router.navigate({ href: returnTo });
      });
    }
  }, [isAuthenticated, isPending, queryClient, returnTo, router]);

  async function handleGoogleSignIn() {
    setIsGooglePending(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: returnTo,
        errorCallbackURL: buildOAuthErrorHref(redirect),
      });

      if (result.error) {
        throw new Error(result.error.message?.trim() || "Google sign-in failed");
      }
    } catch (error) {
      logClientError("auth.google", error);
      toastManager.add({
        title: getUserSafeErrorMessage(error, "Google sign-in failed"),
        type: "error",
      });
      setIsGooglePending(false);
    }
  }

  if (isPending) {
    return <AuthLoading />;
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to continue to Kyomi."
      footer={
        <>
          New to Kyomi?{" "}
          <a className={authLinkClassName} href={buildAuthEntryHref("/register", redirect)}>
            Create an account
          </a>
        </>
      }
    >
      {authError === "oauth" && googleOAuthEnabled ? (
        <p
          className="rounded-lg bg-destructive/8 px-3 py-2 text-destructive-foreground text-sm"
          role="alert"
        >
          Google sign-in couldn’t be completed. Try again.
        </p>
      ) : null}

      {googleOAuthEnabled ? (
        <>
          <GoogleAuthButton loading={isGooglePending} onClick={() => void handleGoogleSignIn()} />
          <AuthDivider />
        </>
      ) : null}

      <Form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field name="email">
          {(field) => {
            const canShow = field.state.meta.isTouched || field.form.state.isSubmitted;
            const errorMessage = getFieldErrorMessage(field.state.meta.errors, canShow);

            return (
              <Field>
                <FieldLabel>Email</FieldLabel>
                <Input
                  aria-invalid={Boolean(errorMessage) || undefined}
                  autoComplete="email"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  value={field.state.value}
                />
                {errorMessage ? (
                  <FieldError match={true}>{errorMessage as string}</FieldError>
                ) : null}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="password">
          {(field) => {
            const canShow = field.state.meta.isTouched || field.form.state.isSubmitted;
            const errorMessage = getFieldErrorMessage(field.state.meta.errors, canShow);

            return (
              <PasswordField
                action={
                  passwordResetEnabled ? (
                    <a
                      className="text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
                      href={buildAuthEntryHref("/forgot-password", redirect)}
                    >
                      Forgot password?
                    </a>
                  ) : undefined
                }
                autoComplete="current-password"
                errorMessage={errorMessage as string | null}
                label="Password"
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Enter your password"
                value={field.state.value}
              />
            );
          }}
        </form.Field>

        <form.Subscribe selector={(state) => [state.isSubmitting]}>
          {([isSubmitting]) => (
            <Button className="w-full" loading={Boolean(isSubmitting)} type="submit">
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          )}
        </form.Subscribe>
      </Form>
    </AuthCard>
  );
}
