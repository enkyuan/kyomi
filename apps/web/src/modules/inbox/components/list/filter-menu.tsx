"use client";

import { Filter2Fill } from "@mingcute/react";
import type React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@kyomi/ui/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuPopup,
  MenuTrigger,
} from "@kyomi/ui/menu";
import type { InboxFilter } from "@modules/inbox/services/api";

type FilterMenuProps = {
  filter: InboxFilter;
  showHidden: boolean;
  showRead: boolean;
};

export function FilterMenu({ filter, showHidden, showRead }: FilterMenuProps): React.ReactElement {
  const navigate = useNavigate();
  const canApplyReadScopedFilters = filter === "today";

  const updateSearch = (next: { showHidden?: boolean; showRead?: boolean }) => {
    void navigate({
      from: "/inbox/",
      search: (prev) => {
        const nextShowHidden = next.showHidden ?? showHidden;
        const nextShowRead = next.showRead ?? showRead;

        return {
          ...prev,
          showHidden: nextShowHidden ? "1" : undefined,
          showRead: nextShowRead ? "1" : undefined,
          itemId: undefined,
        };
      },
    });
  };

  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            aria-label="List filters"
            className="text-muted-foreground hover:text-foreground"
            size="icon"
            variant="ghost"
          />
        }
      >
        <Filter2Fill className="size-4" />
      </MenuTrigger>
      <MenuPopup align="end">
        {canApplyReadScopedFilters ? (
          <MenuGroup>
            <MenuGroupLabel>Filters</MenuGroupLabel>
            <MenuCheckboxItem
              checked={showHidden}
              onCheckedChange={(checked) => {
                updateSearch({ showHidden: checked === true });
              }}
            >
              Hidden
            </MenuCheckboxItem>
            <MenuCheckboxItem
              checked={showRead}
              onCheckedChange={(checked) => {
                updateSearch({ showRead: checked === true });
              }}
            >
              Read
            </MenuCheckboxItem>
          </MenuGroup>
        ) : (
          <div className="px-2 py-1.5 text-muted-foreground text-xs">
            No extra filters in this view.
          </div>
        )}
      </MenuPopup>
    </Menu>
  );
}
