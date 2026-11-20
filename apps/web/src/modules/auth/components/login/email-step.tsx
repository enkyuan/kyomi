import { Button } from "@kyomi/ui/components/button";
import { AccountHeading } from "./layout";
import { Form } from "@kyomi/ui/components/form";
import { Field, FieldError, FieldLabel } from "@kyomi/ui/components/field";
import { InputPrimitive } from "@kyomi/ui/components/input";
import { getFieldErrorMessage } from "@modules/auth/schema";
import type { useEmailForm } from "./hooks";

export function EmailStep({
  emailForm,
  register,
}: {
  emailForm: ReturnType<typeof useEmailForm>;
  register: boolean;
}) {
  return (
    <>
      <AccountHeading title={register ? "Create your Kyomi account" : "Sign in to Kyomi"}>
        {register
          ? "Enter your email to get started."
          : "Enter your email to receive a sign-in code."}
      </AccountHeading>
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
              <Field invalid={Boolean(errorMessage)}>
                <FieldLabel className="sr-only">Email</FieldLabel>
                <InputPrimitive
                  className="h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base text-foreground outline-none transition-shadow placeholder:text-muted-subtle focus-visible:border-ring focus-visible:ring-(length:--field-ring-width) focus-visible:ring-ring/24 aria-invalid:border-destructive/64 aria-invalid:focus-visible:ring-destructive/16 sm:text-sm dark:bg-input/32"
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
            <Button className="w-full" size="xl" type="submit" loading={Boolean(isSubmitting)}>
              Continue
            </Button>
          )}
        </emailForm.Subscribe>
      </Form>
    </>
  );
}
