"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { authClient } from "@lib/auth/client";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import { Button } from "@kyomi/ui/atoms/button";
import { Form } from "@kyomi/ui/atoms/form";
import { AuthCard, authLinkClassName } from "@modules/auth/components/auth-card";
import { PasswordField } from "@modules/auth/components/password-field";
import { buildAuthEntryHref } from "@modules/auth/redirect";
import {
  getFieldErrorMessage,
  resetPasswordDefaultValues,
  resetPasswordFormValidator,
} from "@modules/auth/schema";

type ResetPasswordProps = {
  token?: string;
  resetError?: boolean;
  redirect?: string;
};

export function ResetPassword({ token, resetError, redirect }: ResetPasswordProps) {
  const [isComplete, setIsComplete] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: resetPasswordDefaultValues,
    validators: {
      onChange: resetPasswordFormValidator,
      onSubmit: resetPasswordFormValidator,
    },
    onSubmit: async ({ value }) => {
      if (!token) {
        return;
      }

      setSubmitError(null);
      try {
        const result = await authClient.resetPassword({
          newPassword: value.password,
          token,
        });

        if (result.error) {
          throw new Error(result.error.message?.trim() || "Could not reset your password");
        }

        setIsComplete(true);
      } catch (error) {
        logClientError("auth.password_reset.complete", error);
        setSubmitError(getUserSafeErrorMessage(error, "Could not reset your password"));
      }
    },
  });

  if (resetError || !token) {
    return (
      <AuthCard
        title="Reset link expired"
        description="This reset link is invalid or has expired. Request a new one to continue."
        footer={
          <a className={authLinkClassName} href={buildAuthEntryHref("/", redirect)}>
            Back to sign in
          </a>
        }
      >
        <Button
          className="w-full"
          render={
            <a
              aria-label="Request a new password reset link"
              href={buildAuthEntryHref("/forgot-password", redirect)}
            />
          }
        >
          Request a new link
        </Button>
      </AuthCard>
    );
  }

  if (isComplete) {
    return (
      <AuthCard
        title="Password updated"
        description="Your password has been changed. You can now sign in with the new password."
      >
        <Button
          className="w-full"
          render={<a aria-label="Continue to sign in" href={buildAuthEntryHref("/", redirect)} />}
        >
          Continue to sign in
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" description="Use at least 8 characters.">
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field name="password">
          {(field) => {
            const canShow = field.state.meta.isTouched || field.form.state.isSubmitted;
            const errorMessage = getFieldErrorMessage(field.state.meta.errors, canShow);

            return (
              <PasswordField
                autoComplete="new-password"
                autoFocus
                errorMessage={errorMessage as string | null}
                label="New password"
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
                label="Confirm new password"
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Repeat your password"
                value={field.state.value}
              />
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
              {isSubmitting ? "Updating password…" : "Update password"}
            </Button>
          )}
        </form.Subscribe>
      </Form>
    </AuthCard>
  );
}
