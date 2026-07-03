"use client";

import { useState } from "react";
import type { InboxItem } from "@modules/inbox/services/api";
import { cn } from "@kyomi/ui/lib/utils";
import { ReportArticleDialog } from "../report-article";
import { useToolbarModel } from "./model";
import { Toolbar } from "./view";

export function ItemInlineToolbar({ item, className }: { item: InboxItem; className?: string }) {
  const [reportOpen, setReportOpen] = useState(false);
  const toolbar = useToolbarModel({
    item,
    onReportBrokenArticle: () => setReportOpen(true),
  });

  return (
    <>
      <Toolbar
        {...toolbar.toolbarProps}
        className={cn("border-0 bg-transparent p-0 text-muted-foreground shadow-none", className)}
      />
      <ReportArticleDialog item={item} open={reportOpen} onOpenChange={setReportOpen} />
    </>
  );
}
