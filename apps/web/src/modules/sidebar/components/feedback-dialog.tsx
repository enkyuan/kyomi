"use client";

import { useState } from "react";
import { Button } from "@kyomi/ui/components/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@kyomi/ui/components/dialog";
import { Form } from "@kyomi/ui/components/form";
import { ScrollAreaPrimitive, ScrollBar } from "@kyomi/ui/components/scroll-area";

/** The feedback composer, opened from the sidebar's feedback button. */
export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Feedback</DialogTitle>
          <DialogDescription>
            Tell us what feels off, what is missing, or what you want next.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <Form
            onSubmit={(event) => {
              event.preventDefault();
              setValue("");
              onOpenChange(false);
            }}
          >
            <div className="feedback-composer">
              <ScrollAreaPrimitive.Root className="feedback-composer-scroll">
                <ScrollAreaPrimitive.Viewport
                  className="feedback-composer-viewport"
                  data-slot="scroll-area-viewport"
                >
                  <textarea
                    aria-label="Feedback message"
                    className="feedback-composer-textarea"
                    placeholder="Compose your message"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                  />
                </ScrollAreaPrimitive.Viewport>
                <ScrollBar className="feedback-composer-scrollbar" orientation="vertical" />
                <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
              </ScrollAreaPrimitive.Root>
              <div className="feedback-composer-toolbar">
                <Button className="feedback-composer-submit" size="sm" type="submit">
                  Send
                </Button>
              </div>
            </div>
          </Form>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
