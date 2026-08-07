import type { ReactNode } from "react";

export const ACTION_MENU_ICON_SIZE = 40;

export type ActionMenuItem = {
  readonly id: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly accessibilityLabel?: string;
  readonly onPress?: () => void;
};

export type ActionMenuAnchor = {
  readonly content: ReactNode;
  readonly bottomOffset: number;
  readonly edgeOffset: number;
  readonly height: number;
  readonly width: number;
};
