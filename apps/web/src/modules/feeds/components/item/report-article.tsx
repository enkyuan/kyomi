"use client";

import { useState, type SyntheticEvent } from "react";
import { Button } from "@kyomi/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@kyomi/ui/dialog";
import { Field } from "@kyomi/ui/field";
import { Form } from "@kyomi/ui/form";
import { Textarea } from "@kyomi/ui/textarea";
import { toastManager } from "@kyomi/ui/toast";
import { reportBrokenArticle, type InboxItem } from "@modules/inbox/services/api";

function stopDialogPropagation(event: SyntheticEvent) {
  event.stopPropagation();
}

export function ReportArticleDialog({
  item,
  open,
  onOpenChange,
}: {
  item: InboxItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [details, setDetails] = useState("");
  const [isPending, setIsPending] = useState(false);

  const submit = async () => {
    setIsPending(true);
    try {
      await reportBrokenArticle({
        data: {
          itemId: item.id,
          reason: "broken_article",
          details,
        },
      });
      setDetails("");
      onOpenChange(false);
      toastManager.add({
        title: "Report sent",
        description: "Thanks. This article is marked for review.",
        type: "success",
        timeout: 3000,
      });
    } catch {
      toastManager.add({
        title: "Report failed",
        description: "Try again in a moment.",
        type: "error",
        timeout: 7000,
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup
        showCloseButton={false}
        onClick={stopDialogPropagation}
        onPointerDown={stopDialogPropagation}
      >
        <DialogHeader>
          <DialogTitle>Report broken article</DialogTitle>
          <DialogDescription>{item.title}</DialogDescription>
        </DialogHeader>
        <Form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <DialogPanel>
            <Field>
              <Textarea
                className="max-h-56 [&_textarea]:max-h-56 [&_textarea]:resize-y"
                placeholder="What looks broken?"
                size="lg"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
              />
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />} disabled={isPending}>
              Cancel
            </DialogClose>
            <Button loading={isPending} type="submit">
              Send
            </Button>
          </DialogFooter>
        </Form>
      </DialogPopup>
    </Dialog>
  );
}
