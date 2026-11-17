"use client";

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
import { Field, FieldError } from "@kyomi/ui/components/field";
import { Form } from "@kyomi/ui/components/form";
import { Input } from "@kyomi/ui/components/input";

type EmailDialogProps = {
  draft: string;
  error: string | null;
  isSaving: boolean;
  onDraftChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => Promise<void>;
  open: boolean;
};

/** Change-email form. The account panel owns the draft, validation and mutation. */
export function EmailDialog({
  draft,
  error,
  isSaving,
  onDraftChange,
  onOpenChange,
  onSubmit,
  open,
}: EmailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-sm" showCloseButton={false}>
        <Form
          className="contents"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Change email</DialogTitle>
            <DialogDescription>
              Enter the address you want to use for your account.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="grid gap-4">
            <Field>
              <Input
                aria-invalid={error ? true : undefined}
                aria-label="Email"
                autoComplete="email"
                onChange={(event) => {
                  onDraftChange(event.target.value);
                }}
                placeholder="you@example.com"
                type="email"
                value={draft}
              />
              {error ? <FieldError match={true}>{error}</FieldError> : null}
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose disabled={isSaving} render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button loading={isSaving} type="submit">
              Save email
            </Button>
          </DialogFooter>
        </Form>
      </DialogPopup>
    </Dialog>
  );
}
