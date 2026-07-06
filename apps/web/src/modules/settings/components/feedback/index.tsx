"use client";

import { useState } from "react";
import { AttachmentLine, Message3Fill, PicLine } from "@mingcute/react";
import { Button } from "@kyomi/ui/button";
import { Form } from "@kyomi/ui/form";
import { ScrollAreaPrimitive, ScrollBar } from "@kyomi/ui/scroll-area";
import { SidebarMenuButton, SidebarMenuItem } from "@kyomi/ui/sidebar";
import { SettingHeading } from "../appearance/shared";

export const feedbackSection = {
  description: "Tell us what feels off, what is missing, or what you want next.",
  icon: Message3Fill,
  name: "Feedback",
} as const;

type FeedbackPageNavProps = {
  isActive: boolean;
  onSelect: () => void;
};

export function FeedbackPageNav({ isActive, onSelect }: FeedbackPageNavProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} onClick={onSelect}>
        <Message3Fill />
        <span>{feedbackSection.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function FeedbackPagePanel() {
  const [value, setValue] = useState("");

  const clearFeedback = () => {
    setValue("");
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SettingHeading title={feedbackSection.name} description={feedbackSection.description} />
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            clearFeedback();
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
                  onChange={(event) => {
                    setValue(event.target.value);
                  }}
                  placeholder="Compose your message..."
                  value={value}
                />
              </ScrollAreaPrimitive.Viewport>
              <ScrollBar className="feedback-composer-scrollbar" orientation="vertical" />
              <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
            </ScrollAreaPrimitive.Root>
            <div className="feedback-composer-toolbar">
              <div className="feedback-composer-actions">
                <Button
                  aria-label="Attach file"
                  className="feedback-composer-icon-button"
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <AttachmentLine />
                </Button>
                <Button
                  aria-label="Attach image"
                  className="feedback-composer-icon-button"
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <PicLine />
                </Button>
              </div>
              <Button className="feedback-composer-submit" size="sm" type="submit">
                Send
              </Button>
            </div>
          </div>
        </Form>
      </section>
    </div>
  );
}
