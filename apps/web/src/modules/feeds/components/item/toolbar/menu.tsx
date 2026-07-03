"use client";

import { ExternalLinkLine, EyeCloseLine, More2Line, ReportLine } from "@mingcute/react";
import { Button } from "@kyomi/ui/button";
import { Menu, MenuPopup, MenuTrigger } from "@kyomi/ui/menu";
import { ToolbarButton } from "@kyomi/ui/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/tooltip";
import { ItemToolbarMenuItem } from "./menu-item";

const TOOLBAR_ICON_CLASS = "size-5";

export function ItemToolbarMenu({
  onHide,
  onOpenSource,
  onReportBrokenArticle,
}: {
  onHide: () => void;
  onOpenSource: () => void;
  onReportBrokenArticle: () => void;
}) {
  return (
    <Menu>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
              render={
                <ToolbarButton
                  aria-label="More"
                  render={
                    <Button
                      className="size-10 rounded-xl text-muted-foreground hover:text-foreground sm:size-9"
                      size="icon-lg"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    />
                  }
                >
                  <More2Line className={TOOLBAR_ICON_CLASS} />
                </ToolbarButton>
              }
            />
          }
        />
        <TooltipPopup sideOffset={8}>More</TooltipPopup>
      </Tooltip>
      <MenuPopup
        align="end"
        sideOffset={8}
        className="min-w-48 rounded-xl p-1 before:rounded-[11px]"
      >
        <ItemToolbarMenuItem label="Open source" onClick={onOpenSource}>
          <ExternalLinkLine />
        </ItemToolbarMenuItem>
        <ItemToolbarMenuItem label="Not interested" onClick={onHide}>
          <EyeCloseLine />
        </ItemToolbarMenuItem>
        <ItemToolbarMenuItem label="Report broken article" onClick={onReportBrokenArticle}>
          <ReportLine />
        </ItemToolbarMenuItem>
      </MenuPopup>
    </Menu>
  );
}
