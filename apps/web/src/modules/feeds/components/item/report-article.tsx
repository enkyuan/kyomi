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
import { Checkbox } from "@kyomi/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@kyomi/ui/field";
import { Form } from "@kyomi/ui/form";
import { Input } from "@kyomi/ui/input";
import { toastManager } from "@kyomi/ui/toast";
import {
  reportBrokenArticle,
  type InboxItem,
  type ReportBrokenArticleInput,
} from "@modules/inbox/lib/articles/index";

const MAX_SELECTED_REASONS = 3;

type ReportReasonId =
  | "missing_content"
  | "wrong_content"
  | "low_quality"
  | "not_interested"
  | "spam"
  | "other";

type ReportReasonOption = {
  id: ReportReasonId;
  label: string;
  reportReason: NonNullable<ReportBrokenArticleInput["reason"]>;
};

const REPORT_REASON_OPTIONS: ReportReasonOption[] = [
  {
    id: "missing_content",
    label: "Article is empty or won't load",
    reportReason: "missing_content",
  },
  {
    id: "wrong_content",
    label: "Wrong article or content mismatch",
    reportReason: "wrong_content",
  },
  {
    id: "low_quality",
    label: "Low-quality, clickbait, or not useful",
    reportReason: "broken_article",
  },
  {
    id: "not_interested",
    label: "Not interested in this topic",
    reportReason: "broken_article",
  },
  {
    id: "spam",
    label: "Spam, ad, or offensive content",
    reportReason: "feed_error",
  },
  {
    id: "other",
    label: "Other",
    reportReason: "broken_article",
  },
];

function stopDialogPropagation(event: SyntheticEvent) {
  event.stopPropagation();
}

function formatReportDetails(selectedReasonIds: ReportReasonId[], otherDetails: string) {
  const lines: string[] = [];
  for (const option of REPORT_REASON_OPTIONS) {
    if (option.id !== "other" && selectedReasonIds.includes(option.id)) {
      lines.push(`- ${option.label}`);
    }
  }
  const trimmedOtherDetails = otherDetails.trim();

  if (selectedReasonIds.includes("other") && trimmedOtherDetails) {
    lines.push(`- Other: ${trimmedOtherDetails}`);
  }

  return lines.join("\n");
}

function getPrimaryReportReason(
  selectedReasonIds: ReportReasonId[],
): NonNullable<ReportBrokenArticleInput["reason"]> {
  return (
    REPORT_REASON_OPTIONS.find((option) => selectedReasonIds.includes(option.id))?.reportReason ??
    "broken_article"
  );
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
  const [selectedReasonIds, setSelectedReasonIds] = useState<ReportReasonId[]>([]);
  const [otherDetails, setOtherDetails] = useState("");
  const [isPending, setIsPending] = useState(false);
  const otherSelected = selectedReasonIds.includes("other");

  const toggleReason = (reasonId: ReportReasonId, checked: boolean) => {
    setSelectedReasonIds((current) => {
      if (!checked) {
        return current.filter((selectedReasonId) => selectedReasonId !== reasonId);
      }
      if (current.includes(reasonId) || current.length >= MAX_SELECTED_REASONS) {
        return current;
      }
      return [...current, reasonId];
    });
  };

  const submit = async () => {
    if (selectedReasonIds.length === 0 || (otherSelected && !otherDetails.trim())) {
      return;
    }
    setIsPending(true);
    try {
      await reportBrokenArticle({
        data: {
          itemId: item.id,
          reason: getPrimaryReportReason(selectedReasonIds),
          details: formatReportDetails(selectedReasonIds, otherDetails),
        },
      });
      setSelectedReasonIds([]);
      setOtherDetails("");
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
            <Field className="gap-3">
              <div className="flex w-full items-center justify-between gap-3">
                <FieldLabel>Why don't you want to see this?</FieldLabel>
                <span className="shrink-0 text-muted-foreground text-xs">
                  Pick up to {MAX_SELECTED_REASONS}
                </span>
              </div>
              <div className="grid w-full gap-2" role="group" aria-label="Report reasons">
                {REPORT_REASON_OPTIONS.map((option) => {
                  const checked = selectedReasonIds.includes(option.id);
                  const disabled = !checked && selectedReasonIds.length >= MAX_SELECTED_REASONS;

                  return (
                    <label
                      key={option.id}
                      className="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-sm text-foreground transition-colors has-disabled:cursor-not-allowed has-disabled:opacity-60 hover:bg-accent/60"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled || isPending}
                        onCheckedChange={(nextChecked) =>
                          toggleReason(option.id, nextChecked === true)
                        }
                      />
                      <span className="min-w-0 flex-1">{option.label}</span>
                    </label>
                  );
                })}
              </div>
              {otherSelected ? (
                <Input
                  aria-label="Other reason"
                  placeholder="Tell us what else is off"
                  value={otherDetails}
                  onChange={(event) => setOtherDetails(event.target.value)}
                />
              ) : null}
              {otherSelected && !otherDetails.trim() ? (
                <FieldDescription className="text-destructive">
                  Make sure to add a short note for this option.
                </FieldDescription>
              ) : null}
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />} disabled={isPending}>
              Cancel
            </DialogClose>
            <Button
              disabled={selectedReasonIds.length === 0 || (otherSelected && !otherDetails.trim())}
              loading={isPending}
              type="submit"
            >
              Send
            </Button>
          </DialogFooter>
        </Form>
      </DialogPopup>
    </Dialog>
  );
}
