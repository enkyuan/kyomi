"use client";

import { EyeCloseLine, EyeLine } from "@mingcute/react";
import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { authClient } from "@lib/auth/client";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@kyomi/ui/input/group";
import { Spinner } from "@kyomi/ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/tooltip";
import { toastManager } from "@kyomi/ui/toast";
import {
  getFieldErrorMessage,
  registerDefaultValues,
  registerFormValidator,
} from "@modules/auth/schema";

export function Register() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isPending } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
          error: (error) => {
            logClientError("auth.register", error);
            return {
              description: getUserSafeErrorMessage(error, "An error occurred during sign up"),
              title: "Sign up failed",
              type: "error",
            };
          },
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
                    <InputGroup>
                      <InputGroupInput
                        aria-label="Password with toggle visibility"
                        autoComplete="new-password"
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="Create a password"
                        type={showPassword ? "text" : "password"}
                        value={field.state.value}
                      />
                      <InputGroupAddon align="inline-end">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                onClick={() => setShowPassword((visible) => !visible)}
                                size="icon-xs"
                                type="button"
                                variant="ghost"
                              />
                            }
                          >
                            {showPassword ? <EyeCloseLine /> : <EyeLine />}
                          </TooltipTrigger>
                          <TooltipPopup>
                            {showPassword ? "Hide password" : "Show password"}
                          </TooltipPopup>
                        </Tooltip>
                      </InputGroupAddon>
                    </InputGroup>
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
                    <InputGroup>
                      <InputGroupInput
                        aria-label="Password with toggle visibility"
                        autoComplete="new-password"
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="Confirm your password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={field.state.value}
                      />
                      <InputGroupAddon align="inline-end">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                onClick={() => setShowConfirmPassword((visible) => !visible)}
                                size="icon-xs"
                                type="button"
                                variant="ghost"
                              />
                            }
                          >
                            {showConfirmPassword ? <EyeCloseLine /> : <EyeLine />}
                          </TooltipTrigger>
                          <TooltipPopup>
                            {showConfirmPassword ? "Hide password" : "Show password"}
                          </TooltipPopup>
                        </Tooltip>
                      </InputGroupAddon>
                    </InputGroup>
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
