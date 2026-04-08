"use client";

import { useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { Link, useRouter } from "@tanstack/react-router";
import { authClient } from "@lib/auth-client";
import { useAuth } from "@integrations/better-auth/auth-provider";
import { Button } from "@components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@components/ui/card";
import { Form } from "@components/ui/form";
import { Field, FieldError, FieldLabel } from "@components/ui/field";
import { Input } from "@components/ui/input";
import { toastManager } from "@components/ui/toast";
import { getFieldErrorMessage, registerDefaultValues, registerFormSchema } from "./schema";

export function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated, isPending } = useAuth();
  const form = useForm({
    defaultValues: registerDefaultValues,
    validators: {
      onChange: registerFormSchema,
      onSubmit: registerFormSchema,
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

          await router.invalidate();
          await router.navigate({ to: "/inbox" });
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
            title: "Signing up...",
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
      void router.navigate({ to: "/inbox" });
    }
  }, [isAuthenticated, isPending, router]);

  if (isPending) {
    return null;
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
                    <Input
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="Create a password"
                      type="password"
                      autoComplete="new-password"
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
                    <Input
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="Confirm your password"
                      type="password"
                      autoComplete="new-password"
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
                  {isSubmitting ? "Signing up..." : "Sign up"}
                </Button>
              )}
            </form.Subscribe>
          </Form>
        </CardPanel>
      </Card>
    </main>
  );
}
