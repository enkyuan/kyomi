"use client";

import { useState } from "react";
import { Message3Fill } from "@mingcute/react";
import { Button } from "@kyomi/ui/button";
import { Field } from "@kyomi/ui/field";
import { Form } from "@kyomi/ui/form";
import { SidebarMenuButton, SidebarMenuItem } from "@kyomi/ui/sidebar";
import { Textarea } from "@kyomi/ui/textarea";
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
          <Field>
            <Textarea
              className="max-h-72 [&_textarea]:max-h-72 [&_textarea]:resize-y [&_textarea]:overflow-auto"
              onChange={(event) => {
                setValue(event.target.value);
              }}
              placeholder="Write your feedback..."
              size="lg"
              value={value}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={clearFeedback}>
              Clear
            </Button>
            <Button type="submit">Send</Button>
          </div>
        </Form>
      </section>
    </div>
  );
}
