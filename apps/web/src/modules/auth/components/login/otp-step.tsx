import { Button } from "@kyomi/ui/components/button";
import {
  CardAction,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@kyomi/ui/components/card";
import { Form } from "@kyomi/ui/components/form";
import { Field, FieldError, FieldLabel } from "@kyomi/ui/components/field";
import { OTPField, OTPFieldInput, OTPFieldSeparator } from "@kyomi/ui/components/otp-field";
import { getFieldErrorMessage } from "@modules/auth/schema";
import { useResendCode, type useOtpForm } from "./hooks";

export function OtpStep({
  email,
  otpForm,
  onEdit,
}: {
  email: string;
  otpForm: ReturnType<typeof useOtpForm>;
  onEdit: () => void;
}) {
  const { handleResendCode, isResending } = useResendCode(email);

  return (
    <>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>Enter verification code</CardTitle>
          <CardDescription>
            We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
          </CardDescription>
        </div>
        <CardAction>
          <button
            type="button"
            onClick={onEdit}
            className="text-foreground text-sm leading-4.5 hover:text-foreground/80 hover:underline cursor-pointer"
          >
            Edit
          </button>
        </CardAction>
      </CardHeader>
      <CardPanel>
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void otpForm.handleSubmit();
          }}
        >
          <otpForm.Field name="otp">
            {(field) => {
              const canShow = field.state.meta.isTouched || field.form.state.isSubmitted;
              const errorMessage = getFieldErrorMessage(field.state.meta.errors, canShow);

              return (
                <Field className="items-center">
                  <FieldLabel className="sr-only">Verification code</FieldLabel>
                  <OTPField
                    aria-label="Verification code"
                    length={6}
                    autoSubmit
                    value={field.state.value}
                    onValueChange={(val) => field.handleChange(val)}
                  >
                    <OTPFieldInput autoFocus />
                    <OTPFieldInput aria-label="Character 2 of 6" />
                    <OTPFieldInput aria-label="Character 3 of 6" />
                    <OTPFieldSeparator />
                    <OTPFieldInput aria-label="Character 4 of 6" />
                    <OTPFieldInput aria-label="Character 5 of 6" />
                    <OTPFieldInput aria-label="Character 6 of 6" />
                  </OTPField>
                  {errorMessage ? (
                    <FieldError match={true}>{errorMessage as string}</FieldError>
                  ) : null}
                </Field>
              );
            }}
          </otpForm.Field>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <button
              type="button"
              onClick={onEdit}
              className="hover:text-foreground hover:underline transition-colors cursor-pointer"
            >
              Back to email
            </button>
            <button
              type="button"
              onClick={() => void handleResendCode()}
              disabled={isResending}
              className="font-medium text-foreground hover:underline transition-colors cursor-pointer disabled:opacity-50"
            >
              {isResending ? "Resending…" : "Resend code"}
            </button>
          </div>

          <otpForm.Subscribe selector={(state) => [state.isSubmitting]}>
            {([isSubmitting]) => (
              <Button className="w-full" shape="pill" type="submit" loading={Boolean(isSubmitting)}>
                Continue
              </Button>
            )}
          </otpForm.Subscribe>
        </Form>
      </CardPanel>
    </>
  );
}
