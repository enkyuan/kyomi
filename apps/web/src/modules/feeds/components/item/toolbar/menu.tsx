"use client";

import { ExternalLinkLine, EyeCloseLine, More1Line, ReportLine } from "@kyomi/ui/icons/mingcute";
import { Button } from "@kyomi/ui/atoms/button";
import { Menu, MenuPopup, MenuTrigger } from "@kyomi/ui/atoms/menu";
import { ToolbarButton } from "@kyomi/ui/atoms/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/atoms/tooltip";
import { ItemToolbarMenuItem } from "./menu-item";

const TOOLBAR_ICON_CLASS = "size-5";
const TOOLBAR_TOOLTIP_SIDE_OFFSET = 6;

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
                  <More1Line className={TOOLBAR_ICON_CLASS} />
                </ToolbarButton>
              }
            />
          }
        />
        <TooltipPopup sideOffset={TOOLBAR_TOOLTIP_SIDE_OFFSET}>More</TooltipPopup>
      </Tooltip>
      <MenuPopup align="end" sideOffset={8} className="min-w-48 rounded-xl before:rounded-[11px]">
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
