"use client";

import { useEffect, useState } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@integrations/better-auth/provider";
import { authClient } from "@lib/auth/client";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import { Button } from "@kyomi/ui/atoms/button";
import { Field, FieldError, FieldLabel } from "@kyomi/ui/atoms/field";
import { Form } from "@kyomi/ui/atoms/form";
import { Input } from "@kyomi/ui/atoms/input";
import { toastManager } from "@kyomi/ui/atoms/toast";
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
import {
  getFieldErrorMessage,
  registerDefaultValues,
  registerFormValidator,
} from "@modules/auth/schema";
import { prefetchInboxFlow } from "@modules/inbox";

type RegisterProps = {
  redirect?: string;
  googleOAuthEnabled?: boolean;
  authError?: "oauth";
};

export function Register({ redirect, googleOAuthEnabled = false, authError }: RegisterProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isPending } = useAuth();
  const returnTo = resolveAuthReturnTo(redirect);
  const [isGooglePending, setIsGooglePending] = useState(false);
  const form = useForm({
    defaultValues: registerDefaultValues,
    validators: {
      onChange: registerFormValidator,
      onSubmit: registerFormValidator,
    },
    onSubmit: async ({ value }) => {
      await toastManager.promise(
        (async () => {
          const result = await authClient.signUp.email({
            email: value.email,
            password: value.password,
            name: "",
            callbackURL: returnTo,
          });

          if (result.error) {
            throw new Error(result.error.message?.trim() || "An error occurred during sign up");
          }

          await Promise.all([router.invalidate(), prefetchInboxFlow(router, queryClient)]);
          await router.navigate({ href: returnTo });
        })(),
        {
          error: (error) => {
            logClientError("auth.register", error);
            return {
              title: getUserSafeErrorMessage(error, "Sign up failed"),
              type: "error",
            };
          },
          loading: {
            timeout: 0,
            title: "Signing up…",
            type: "loading",
          },
          success: {
            title: "Account created",
            type: "success",
          },
        },
      );
    },
  });
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

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
        errorCallbackURL: buildOAuthErrorHref(redirect, "/register"),
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

  if (isPending && !isSubmitting) {
    return <AuthLoading />;
  }

  return (
    <AuthCard
      title="Create your account"
      description="Start reading with Kyomi."
      footer={
        <>
          Already have an account?{" "}
          <a className={authLinkClassName} href={buildAuthEntryHref("/", redirect)}>
            Sign in
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
                autoComplete="new-password"
                errorMessage={errorMessage as string | null}
                label="Password"
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="At least 8 characters"
                value={field.state.value}
              />
            );
          }}
        </form.Field>

        <form.Field name="confirmPassword">
          {(field) => {
            const canShow = field.state.meta.isTouched || field.form.state.isSubmitted;
            const errorMessage = getFieldErrorMessage(field.state.meta.errors, canShow);

            return (
              <PasswordField
                autoComplete="new-password"
                errorMessage={errorMessage as string | null}
                label="Confirm password"
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Repeat your password"
                value={field.state.value}
              />
            );
          }}
        </form.Field>

        <Button className="w-full" loading={isSubmitting} type="submit">
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </Form>
    </AuthCard>
  );
}
