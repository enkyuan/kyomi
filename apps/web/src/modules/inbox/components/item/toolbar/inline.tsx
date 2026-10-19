"use client";

import { useState } from "react";
import type { InboxItem } from "@modules/articles/lib/api";
import { useItemToolbarModel } from "@modules/inbox/hooks/use-item-toolbar";
import { ReportArticleDialog } from "../report-article";
import { ItemToolbar } from "./index";

export function ItemInlineToolbar({ item, className }: { item: InboxItem; className?: string }) {
  const [reportOpen, setReportOpen] = useState(false);
  const toolbar = useItemToolbarModel({
    item,
    onReportBrokenArticle: () => setReportOpen(true),
  });

  return (
    <>
      <ItemToolbar {...toolbar.toolbarProps} className={className} />
      <ReportArticleDialog item={item} open={reportOpen} onOpenChange={setReportOpen} />
    </>
  );
}
