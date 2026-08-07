"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { authClient } from "@lib/auth/client";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import { Button } from "@kyomi/ui/atoms/button";
import { Field, FieldError, FieldLabel } from "@kyomi/ui/atoms/field";
import { Form } from "@kyomi/ui/atoms/form";
import { Input } from "@kyomi/ui/atoms/input";
import { AuthCard, authLinkClassName } from "@modules/auth/components/auth-card";
import { buildAuthEntryHref } from "@modules/auth/redirect";
import {
  forgotPasswordDefaultValues,
  forgotPasswordFormValidator,
  getFieldErrorMessage,
} from "@modules/auth/schema";

export function ForgotPassword({
  redirect,
  usesDevelopmentLog = false,
}: {
  redirect?: string;
  usesDevelopmentLog?: boolean;
}) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: forgotPasswordDefaultValues,
    validators: {
      onChange: forgotPasswordFormValidator,
      onSubmit: forgotPasswordFormValidator,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const email = value.email.trim();

      try {
        const resetPath = buildAuthEntryHref("/reset-password", redirect);
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: new URL(resetPath, window.location.origin).toString(),
        });

        if (result.error) {
          throw new Error(result.error.message?.trim() || "Could not send the reset link");
        }

        setSentTo(email);
      } catch (error) {
        logClientError("auth.password_reset.request", error);
        setSubmitError(getUserSafeErrorMessage(error, "Could not send the reset link"));
      }
    },
  });

  if (sentTo) {
    return (
      <AuthCard
        title="Check your email"
        description={
          <>
            If an account exists for <span className="text-foreground">{sentTo}</span>, a reset link
            is on its way.
          </>
        }
        footer={
          <a className={authLinkClassName} href={buildAuthEntryHref("/", redirect)}>
            Back to sign in
          </a>
        }
      >
        <p className="text-muted-foreground text-sm">
          {usesDevelopmentLog
            ? "For local development, the reset link appears in the API log. It expires in one hour."
            : "The link expires in one hour. You can close this page after the email arrives."}
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we’ll send you a reset link."
      footer={
        <a className={authLinkClassName} href={buildAuthEntryHref("/", redirect)}>
          Back to sign in
        </a>
      }
    >
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
                  autoFocus
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

        {submitError ? (
          <p className="text-destructive-foreground text-sm" role="alert">
            {submitError}
          </p>
        ) : null}

        <form.Subscribe selector={(state) => [state.isSubmitting]}>
          {([isSubmitting]) => (
            <Button className="w-full" loading={Boolean(isSubmitting)} type="submit">
              {isSubmitting ? "Sending link…" : "Send reset link"}
            </Button>
          )}
        </form.Subscribe>
      </Form>
    </AuthCard>
  );
}
