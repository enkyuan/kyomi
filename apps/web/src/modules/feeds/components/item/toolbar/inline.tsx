"use client";

import { useState } from "react";
import type { InboxItem } from "@modules/inbox/services/api";
import { cn } from "@kyomi/ui/lib/utils";
import { useItemToolbarModel } from "@modules/toolbar/hooks/use-item";
import { ReportArticleDialog } from "../report-article";
import { ItemToolbar } from "./root";

export function ItemInlineToolbar({ item, className }: { item: InboxItem; className?: string }) {
  const [reportOpen, setReportOpen] = useState(false);
  const toolbar = useItemToolbarModel({
    item,
    onReportBrokenArticle: () => setReportOpen(true),
  });

  return (
    <>
      <ItemToolbar
        {...toolbar.toolbarProps}
        className={cn("border-0 bg-transparent p-0 text-muted-foreground shadow-none", className)}
      />
      <ReportArticleDialog item={item} open={reportOpen} onOpenChange={setReportOpen} />
    </>
  );
}
