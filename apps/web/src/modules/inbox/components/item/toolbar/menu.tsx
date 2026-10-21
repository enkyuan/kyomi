"use client";

import { EllipsisIcon, ExternalLinkIcon, EyeOffIcon, FlagIcon } from "@kyomi/ui/icons/blode";
import { Button } from "@kyomi/ui/components/button";
import { Menu, MenuPopup, MenuTrigger } from "@kyomi/ui/components/menu";
import { ToolbarButton } from "@kyomi/ui/components/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/components/tooltip";
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
                      className="size-10 rounded-xl sm:size-9"
                      size="icon-lg"
                      variant="ghost-muted"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    />
                  }
                >
                  <EllipsisIcon className={TOOLBAR_ICON_CLASS} />
                </ToolbarButton>
              }
            />
          }
        />
        <TooltipPopup sideOffset={TOOLBAR_TOOLTIP_SIDE_OFFSET}>More</TooltipPopup>
      </Tooltip>
      <MenuPopup align="end" sideOffset={8} className="min-w-48 rounded-xl before:rounded-[11px]">
        <ItemToolbarMenuItem label="Open source" onClick={onOpenSource}>
          <ExternalLinkIcon />
        </ItemToolbarMenuItem>
        <ItemToolbarMenuItem label="Not interested" onClick={onHide}>
          <EyeOffIcon />
        </ItemToolbarMenuItem>
        <ItemToolbarMenuItem label="Report broken article" onClick={onReportBrokenArticle}>
          <FlagIcon />
        </ItemToolbarMenuItem>
      </MenuPopup>
    </Menu>
  );
}
