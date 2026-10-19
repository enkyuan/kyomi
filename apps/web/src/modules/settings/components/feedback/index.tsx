"use client";

import { useState } from "react";
import { Message3Fill } from "@kyomi/ui/icons/mingcute";
import { Button } from "@kyomi/ui/components/button";
import { Form } from "@kyomi/ui/components/form";
import { ScrollAreaPrimitive, ScrollBar } from "@kyomi/ui/components/scroll-area";
import { SidebarMenuButton, SidebarMenuItem } from "@kyomi/ui/components/sidebar";
import { SettingHeading } from "../appearance/headings";

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
