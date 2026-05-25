"use client";

import { useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { authClient } from "@lib/auth/client";
import { prefetchInboxFlow } from "@modules/inbox";
import { useAuth } from "@integrations/better-auth/provider";
import { Button } from "@vols.rss/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@vols.rss/ui/card";
import { Form } from "@vols.rss/ui/form";
import { Field, FieldError, FieldLabel } from "@vols.rss/ui/field";
import { Input } from "@vols.rss/ui/input";
import { PasswordInput } from "@vols.rss/ui/password-input";
import { Spinner } from "@vols.rss/ui/spinner";
import { toastManager } from "@vols.rss/ui/toast";
import {
  getFieldErrorMessage,
  registerDefaultValues,
  registerFormValidator,
} from "@modules/auth/schema";

export function Register() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isPending } = useAuth();
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
            callbackURL: "/inbox",
          });

          if (result.error) {
            throw new Error(result.error.message?.trim() || "An error occurred during sign up");
          }

          await Promise.all([router.invalidate(), prefetchInboxFlow(router, queryClient)]);
          await router.navigate({ to: "/inbox", search: {} });
        })(),
        {
          error: (error) => ({
            description:
              error instanceof Error ? error.message : "An error occurred during sign up",
            title: "Sign up failed",
            type: "error",
          }),
          loading: {
            description: "Creating your account.",
            timeout: 0,
            title: "Signing up…",
            type: "loading",
          },
          success: {
            description: "Redirecting to your inbox.",
            title: "Account created",
            type: "success",
          },
        },
      );
    },
  });

  useEffect(() => {
    if (!isPending && isAuthenticated) {
      void prefetchInboxFlow(router, queryClient).finally(() => {
        void router.navigate({ to: "/inbox", search: {} });
      });
    }
  }, [isAuthenticated, isPending, queryClient, router]);

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
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Create an account</CardTitle>
            <CardDescription>Enter your details to get started.</CardDescription>
          </div>
          <CardAction>
            <Link
              to="/"
              className="text-foreground text-sm leading-4.5 hover:text-foreground/80 hover:underline"
            >
              Log in
            </Link>
          </CardAction>
        </CardHeader>
        <CardPanel>
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
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="Enter your email"
                      type="email"
                      autoComplete="email"
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
                  <Field>
                    <FieldLabel>Password</FieldLabel>
                    <PasswordInput
                      autoComplete="new-password"
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="Create a password"
                      value={field.state.value}
                    />
                    {errorMessage ? (
                      <FieldError match={true}>{errorMessage as string}</FieldError>
                    ) : null}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="confirmPassword">
              {(field) => {
                const canShow = field.state.meta.isTouched || field.form.state.isSubmitted;
                const errorMessage = getFieldErrorMessage(field.state.meta.errors, canShow);

                return (
                  <Field>
                    <FieldLabel>Confirm Password</FieldLabel>
                    <PasswordInput
                      autoComplete="new-password"
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="Confirm your password"
                      value={field.state.value}
                    />
                    {errorMessage ? (
                      <FieldError match={true}>{errorMessage as string}</FieldError>
                    ) : null}
                  </Field>
                );
              }}
            </form.Field>

            <form.Subscribe selector={(state) => [state.isSubmitting]}>
              {([isSubmitting]) => (
                <Button className="w-full" type="submit" loading={Boolean(isSubmitting)}>
                  {isSubmitting ? "Signing up…" : "Sign up"}
                </Button>
              )}
            </form.Subscribe>
          </Form>
        </CardPanel>
      </Card>
    </main>
  );
}
