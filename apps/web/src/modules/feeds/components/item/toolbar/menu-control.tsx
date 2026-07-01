"use client";

import { ExternalLinkLine, EyeCloseLine, More2Line, ReportLine } from "@mingcute/react";
import { Button } from "@kyomi/ui/button";
import { Menu, MenuPopup, MenuTrigger } from "@kyomi/ui/menu";
import { ToolbarButton } from "@kyomi/ui/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/tooltip";
import { MenuItem } from "./menu-item";

const TOOLBAR_ICON_CLASS = "size-5";

export function MenuControl({
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
        <MenuItem label="Open source" onClick={onOpenSource}>
          <ExternalLinkLine />
        </MenuItem>
        <MenuItem label="Not interested" onClick={onHide}>
          <EyeCloseLine />
        </MenuItem>
        <MenuItem label="Report broken article" onClick={onReportBrokenArticle}>
          <ReportLine />
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
