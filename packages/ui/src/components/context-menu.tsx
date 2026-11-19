/* oxlint-disable react-doctor/only-export-components */
"use client";

import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import type * as React from "react";
import { MenuPopup, type MenuPopupProps } from "./menu";

export const ContextMenu: typeof ContextMenuPrimitive.Root = ContextMenuPrimitive.Root;

/** The area that opens the menu on right click, long press, or the keyboard's menu key. */
export function ContextMenuTrigger(props: ContextMenuPrimitive.Trigger.Props): React.ReactElement {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />;
}

/**
 * The same popup as `Menu`, opening at the pointer instead of beside a trigger button. Its items
 * are `MenuItem`, `MenuSeparator` and the other menu parts.
 */
export function ContextMenuPopup({
  align = "start",
  side = "right",
  sideOffset = 2,
  ...props
}: MenuPopupProps): React.ReactElement {
  return <MenuPopup align={align} side={side} sideOffset={sideOffset} {...props} />;
}
