"use client";

import { useRef, useState } from "react";
import { Button } from "@kyomi/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@kyomi/ui/components/dialog";
import { Field, FieldError, FieldLabel } from "@kyomi/ui/components/field";
import { Input } from "@kyomi/ui/components/input";
import { OTPField, OTPFieldInput, OTPFieldSeparator } from "@kyomi/ui/components/otp-field";
import { EMAIL_CODE_LENGTH, useEmailChange } from "@modules/settings/hooks/use-email-change";

type EmailChange = ReturnType<typeof useEmailChange>;

type EmailDialogProps = {
  currentEmail: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

/**
 * Change-email flow: the new address, a code mailed to the current address, then a code mailed to
 * the new one. The steps mount with the popup, so closing the dialog discards the draft and codes.
 */
export function EmailDialog({ currentEmail, onOpenChange, open }: EmailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-sm" showCloseButton={false}>
        <EmailChangeSteps
          currentEmail={currentEmail}
          onDone={() => {
            onOpenChange(false);
          }}
        />
      </DialogPopup>
    </Dialog>
  );
}

function EmailChangeSteps({ currentEmail, onDone }: { currentEmail: string; onDone: () => void }) {
  const change = useEmailChange({ currentEmail, onDone });

  return change.step === "address" ? (
    <AddressStep change={change} currentEmail={currentEmail} />
  ) : (
    <CodeStep change={change} currentEmail={currentEmail} key={change.step} />
  );
}

// The steps validate and report their own errors inline, so these are plain forms: Base UI's `Form`
// blocks a submit while any field is invalid and would trap a field the server has just rejected.
function AddressStep({ change, currentEmail }: { change: EmailChange; currentEmail: string }) {
  return (
    <form
      className="contents"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void change.submitAddress();
      }}
    >
      <DialogHeader>
        <DialogTitle>Change email</DialogTitle>
        <DialogDescription>
          Enter the address you want to use. We will email a code to{" "}
          <span className="font-medium text-foreground">{currentEmail}</span> to confirm it is you.
        </DialogDescription>
      </DialogHeader>
      <DialogPanel className="grid gap-4">
        <Field invalid={change.error ? true : undefined}>
          <Input
            aria-label="New email address"
            autoComplete="email"
            onChange={(event) => {
              change.handleDraftChange(event.target.value);
            }}
            placeholder="you@example.com"
            type="email"
            value={change.draft}
          />
          {change.error ? <FieldError match={true}>{change.error}</FieldError> : null}
        </Field>
      </DialogPanel>
      <DialogFooter>
        <DialogClose disabled={change.isPending} render={<Button variant="ghost" />}>
          Cancel
        </DialogClose>
        <Button loading={change.isPending} type="submit">
          Continue
        </Button>
      </DialogFooter>
    </form>
  );
}

function CodeStep({ change, currentEmail }: { change: EmailChange; currentEmail: string }) {
  const [code, setCode] = useState("");
  const firstInput = useRef<HTMLInputElement>(null);
  const isCurrentStep = change.step === "current";

  return (
    <form
      className="contents"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const failure = await (isCurrentStep
          ? change.submitCurrentCode(code)
          : change.submitNewCode(code));
        // A rejected full code is cleared so the next complete entry submits again.
        if (failure && code.length === EMAIL_CODE_LENGTH) {
          setCode("");
          firstInput.current?.focus();
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{isCurrentStep ? "Confirm it is you" : "Verify your new email"}</DialogTitle>
        <DialogDescription>
          We sent a 6-digit code to{" "}
          <span className="font-medium text-foreground">
            {isCurrentStep ? currentEmail : change.newEmail}
          </span>
          .
        </DialogDescription>
      </DialogHeader>
      <DialogPanel className="grid gap-4">
        <Field className="items-center" invalid={change.error ? true : undefined}>
          <FieldLabel className="sr-only">Verification code</FieldLabel>
          <OTPField
            aria-label="Verification code"
            autoSubmit
            length={EMAIL_CODE_LENGTH}
            onValueChange={(value) => {
              setCode(value);
              change.clearError();
            }}
            value={code}
          >
            <OTPFieldInput autoFocus ref={firstInput} />
            <OTPFieldInput aria-label="Character 2 of 6" />
            <OTPFieldInput aria-label="Character 3 of 6" />
            <OTPFieldSeparator />
            <OTPFieldInput aria-label="Character 4 of 6" />
            <OTPFieldInput aria-label="Character 5 of 6" />
            <OTPFieldInput aria-label="Character 6 of 6" />
          </OTPField>
          {change.error ? <FieldError match={true}>{change.error}</FieldError> : null}
        </Field>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <button
            className="cursor-pointer transition-colors hover:text-foreground hover:underline disabled:opacity-50"
            disabled={change.isPending}
            onClick={change.goBack}
            type="button"
          >
            {isCurrentStep ? "Back" : "Use a different address"}
          </button>
          {isCurrentStep ? (
            <button
              className="cursor-pointer font-medium text-foreground transition-colors hover:underline disabled:opacity-50"
              disabled={change.isPending}
              onClick={() => void change.resendCurrentCode()}
              type="button"
            >
              Resend code
            </button>
          ) : null}
        </div>
      </DialogPanel>
      <DialogFooter>
        <DialogClose disabled={change.isPending} render={<Button variant="ghost" />}>
          Cancel
        </DialogClose>
        <Button loading={change.isPending} type="submit">
          {isCurrentStep ? "Continue" : "Change email"}
        </Button>
      </DialogFooter>
    </form>
  );
}
