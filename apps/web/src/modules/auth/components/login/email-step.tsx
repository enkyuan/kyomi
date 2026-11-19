import { Button } from "@kyomi/ui/components/button";
import { CardDescription, CardHeader, CardPanel, CardTitle } from "@kyomi/ui/components/card";
import { Form } from "@kyomi/ui/components/form";
import { Field, FieldError, FieldLabel } from "@kyomi/ui/components/field";
import { Input } from "@kyomi/ui/components/input";
import { getFieldErrorMessage } from "@modules/auth/schema";
import type { useEmailForm } from "./hooks";

export function EmailStep({ emailForm }: { emailForm: ReturnType<typeof useEmailForm> }) {
  return (
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
              <Button className="w-full" shape="pill" type="submit" loading={Boolean(isSubmitting)}>
                Continue
              </Button>
            )}
          </emailForm.Subscribe>
        </Form>
      </CardPanel>
    </>
  );
}
