"use client";

import { EyeCloseLine, EyeLine } from "@mingcute/react";
import { useEffect, useState } from "react";
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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@components/ui/input-group";
import { Input } from "@components/ui/input";
import { toastManager } from "@components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@components/ui/tooltip";
import { getFieldErrorMessage, loginDefaultValues, loginFormSchema } from "./schema";

function PasswordInput({
  autoComplete,
  name,
  onBlur,
  onChange,
  placeholder,
  value,
}: {
  autoComplete?: string;
  name: string;
  onBlur: () => void;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  value: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <InputGroup>
      <InputGroupInput
        aria-label="Password with toggle visibility"
        autoComplete={autoComplete}
        name={name}
        onBlur={onBlur}
        onChange={onChange}
        placeholder={placeholder}
        type={showPassword ? "text" : "password"}
        value={value}
      />
      <InputGroupAddon align="inline-end">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
                size="icon-xs"
                type="button"
                variant="ghost"
              />
            }
          >
            {showPassword ? <EyeCloseLine /> : <EyeLine />}
          </TooltipTrigger>
          <TooltipPopup>{showPassword ? "Hide password" : "Show password"}</TooltipPopup>
        </Tooltip>
      </InputGroupAddon>
    </InputGroup>
  );
}

export function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isPending } = useAuth();
  const form = useForm({
    defaultValues: loginDefaultValues,
    validators: {
      onChange: loginFormSchema,
      onSubmit: loginFormSchema,
    },
    onSubmit: async ({ value }) => {
      await toastManager.promise(
        (async () => {
          const result = await authClient.signIn.email({
            email: value.email,
            password: value.password,
            callbackURL: "/inbox",
          });

          if (result.error) {
            throw new Error(result.error.message?.trim() || "Invalid email or password");
          }

          await router.invalidate();
          await router.navigate({ to: "/inbox" });
        })(),
        {
          error: (error) => ({
            description: error instanceof Error ? error.message : "Invalid email or password",
            title: "Login failed",
            type: "error",
          }),
          loading: {
            description: "Authenticating your account.",
            timeout: 0,
            title: "Logging in...",
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
            <CardTitle>Login to your account</CardTitle>
            <CardDescription>Enter your email and password to continue.</CardDescription>
          </div>
          <CardAction>
            <Link
              to="/register"
              className="text-foreground text-sm leading-4.5 hover:text-foreground/80 hover:underline"
            >
              Sign up
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
                      autoComplete="current-password"
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="Enter your password"
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
                  {isSubmitting ? "Logging in..." : "Login"}
                </Button>
              )}
            </form.Subscribe>
          </Form>
        </CardPanel>
      </Card>
    </main>
  );
}
