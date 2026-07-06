"use client";

import type { ReactNode } from "react";
import { MenuItem as MenuPrimitiveItem } from "@kyomi/ui/menu";

export function ItemToolbarMenuItem({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <MenuPrimitiveItem
      className="rounded-lg"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
      <span>{label}</span>
    </MenuPrimitiveItem>
  );
}
