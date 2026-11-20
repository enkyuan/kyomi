import { Button } from "@kyomi/ui/components/button";
import { AccountHeading } from "./layout";
import { Form } from "@kyomi/ui/components/form";
import { Field, FieldError, FieldLabel } from "@kyomi/ui/components/field";
import { OTPField, OTPFieldInput, OTPFieldSeparator } from "@kyomi/ui/components/otp-field";
import { getFieldErrorMessage } from "@modules/auth/schema";
import { useResendCode, useOtpForm } from "./hooks";

const otpInputClassName = "aspect-square h-auto min-w-0 flex-1 sm:h-auto";

export function OtpStep({ email, returnTo }: { email: string; returnTo: string }) {
  const otpForm = useOtpForm(email, returnTo);
  const { handleResendCode, isResending } = useResendCode(email);

  return (
    <>
      <AccountHeading title="Enter verification code">
        We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
      </AccountHeading>
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
                  className="w-full"
                  length={6}
                  autoSubmit
                  value={field.state.value}
                  onValueChange={(val) => field.handleChange(val)}
                >
                  <OTPFieldInput autoFocus className={otpInputClassName} />
                  <OTPFieldInput aria-label="Character 2 of 6" className={otpInputClassName} />
                  <OTPFieldInput aria-label="Character 3 of 6" className={otpInputClassName} />
                  <OTPFieldSeparator />
                  <OTPFieldInput aria-label="Character 4 of 6" className={otpInputClassName} />
                  <OTPFieldInput aria-label="Character 5 of 6" className={otpInputClassName} />
                  <OTPFieldInput aria-label="Character 6 of 6" className={otpInputClassName} />
                </OTPField>
                {errorMessage ? (
                  <FieldError match={true}>{errorMessage as string}</FieldError>
                ) : null}
              </Field>
            );
          }}
        </otpForm.Field>

        <otpForm.Subscribe selector={(state) => [state.isSubmitting]}>
          {([isSubmitting]) => (
            <Button className="w-full" size="xl" type="submit" loading={Boolean(isSubmitting)}>
              Continue
            </Button>
          )}
        </otpForm.Subscribe>

        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="xl"
            type="button"
            onClick={() => void handleResendCode()}
            disabled={isResending}
          >
            {isResending ? "Resending…" : "Resend code"}
          </Button>
        </div>
      </Form>
    </>
  );
}
