export type AnchorRect = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

export type AnchoredToastData = {
  anchorRect?: AnchorRect;
  groupKey?: string;
  tooltipStyle?: boolean;
};

export function getAnchorRect(anchor: Element | null | undefined): AnchorRect | null {
  if (!anchor?.isConnected) {
    return null;
  }

  const rect = anchor.getBoundingClientRect();

  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  };
}
