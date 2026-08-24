"use client";

import { EyeCloseLine, EyeLine } from "@kyomi/ui/icons/mingcute";
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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@kyomi/ui/input/group";
import { Spinner } from "@kyomi/ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/tooltip";
import { toastManager } from "@kyomi/ui/toast";
import { getFieldErrorMessage, loginDefaultValues, loginFormValidator } from "@modules/auth/schema";
import { buildAuthEntryHref, resolveAuthReturnTo } from "@modules/auth/redirect";

export function Login({ redirect }: { redirect?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isPending } = useAuth();
  const returnTo = resolveAuthReturnTo(redirect);
  const [showPassword, setShowPassword] = useState(false);
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
              description: getUserSafeErrorMessage(error, "Invalid email or password"),
              title: "Login failed",
              type: "error",
            };
          },
          loading: {
            description: "Authenticating your account.",
            timeout: 0,
            title: "Logging in…",
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
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Login to your account</CardTitle>
            <CardDescription>Enter your email and password to continue.</CardDescription>
          </div>
          <CardAction>
            <a
              href={buildAuthEntryHref("/register", redirect)}
              className="text-foreground text-sm leading-4.5 hover:text-foreground/80 hover:underline"
            >
              Sign up
            </a>
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
                        autoComplete="current-password"
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="Enter your password"
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

            <form.Subscribe selector={(state) => [state.isSubmitting]}>
              {([isSubmitting]) => (
                <Button className="w-full" type="submit" loading={Boolean(isSubmitting)}>
                  {isSubmitting ? "Logging in…" : "Login"}
                </Button>
              )}
            </form.Subscribe>
          </Form>
        </CardPanel>
      </Card>
    </main>
  );
}
