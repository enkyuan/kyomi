import { useState } from "react";
import type React from "react";
import { Button } from "@kyomi/ui/atoms/button";
import { Field, FieldError, FieldLabel } from "@kyomi/ui/atoms/field";
import { EyeCloseLine, EyeLine } from "@kyomi/ui/icons/mingcute";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@kyomi/ui/atoms/input/group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/atoms/tooltip";

type PasswordFieldProps = Omit<
  React.ComponentProps<typeof InputGroupInput>,
  "type" | "aria-invalid"
> & {
  label: string;
  errorMessage?: string | null;
  action?: React.ReactNode;
};

export function PasswordField({ label, errorMessage, action, ...inputProps }: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const visibilityLabel = showPassword ? "Hide password" : "Show password";

  return (
    <Field>
      <div className="flex w-full items-baseline justify-between gap-4">
        <FieldLabel>{label}</FieldLabel>
        {action}
      </div>
      <InputGroup>
        <InputGroupInput
          {...inputProps}
          aria-invalid={Boolean(errorMessage) || undefined}
          type={showPassword ? "text" : "password"}
        />
        <InputGroupAddon align="inline-end">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={visibilityLabel}
                  onClick={() => setShowPassword((visible) => !visible)}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                />
              }
            >
              {showPassword ? <EyeCloseLine /> : <EyeLine />}
            </TooltipTrigger>
            <TooltipPopup sideOffset={8}>{visibilityLabel}</TooltipPopup>
          </Tooltip>
        </InputGroupAddon>
      </InputGroup>
      {errorMessage ? <FieldError match={true}>{errorMessage}</FieldError> : null}
    </Field>
  );
}
