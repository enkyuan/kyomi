"use client";

import { useState } from "react";
import type { InboxItem } from "@modules/inbox/services/api";
import { cn } from "@lib/utils";
import { BrokenArticleReportDialog } from "../broken-article-report-dialog";
import { Toolbar } from "./toolbar-view";
import { useToolbarModel } from "./toolbar-model";

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
        className={cn(
          "border-0 bg-transparent p-0 text-muted-foreground shadow-none",
          className,
        )}
      />
      <BrokenArticleReportDialog item={item} open={reportOpen} onOpenChange={setReportOpen} />
    </>
  );
}
