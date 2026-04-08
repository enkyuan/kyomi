"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@components/ui/alert-dialog";
import { Button } from "@components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@components/ui/dialog";
import { Field } from "@components/ui/field";
import { Form } from "@components/ui/form";
import { Textarea } from "@components/ui/textarea";

type FeedbackDialogProps = {
  trigger: React.ReactElement;
};

export function FeedbackDialog({ trigger }: FeedbackDialogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [value, setValue] = useState("");

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open && value.trim()) {
          setConfirmOpen(true);
        } else {
          setDialogOpen(open);
        }
      }}
      open={dialogOpen}
    >
      <DialogTrigger render={trigger} />
      <DialogPopup showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Share feedback</DialogTitle>
          <DialogDescription>
            Tell us what feels off, what is missing, or what you want next.
          </DialogDescription>
        </DialogHeader>
        <Form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            setValue("");
            setDialogOpen(false);
          }}
        >
          <DialogPanel>
            <Field>
              <Textarea
                autoFocus
                onChange={(event) => setValue(event.target.value)}
                placeholder="Write your feedback..."
                value={value}
              />
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <Button
              onClick={() => {
                setValue("");
                setDialogOpen(false);
              }}
            >
              Send
            </Button>
          </DialogFooter>
        </Form>
      </DialogPopup>

      <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard feedback?</AlertDialogTitle>
            <AlertDialogDescription>
              Your draft will be lost if you leave now.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>Go back</AlertDialogClose>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                setValue("");
                setDialogOpen(false);
              }}
            >
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </Dialog>
  );
}
