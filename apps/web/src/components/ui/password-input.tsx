import { EyeCloseLine, EyeLine } from "@mingcute/react";
import { useState } from "react";
import { Button } from "@components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@components/ui/input-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@components/ui/tooltip";

export function PasswordInput({
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
