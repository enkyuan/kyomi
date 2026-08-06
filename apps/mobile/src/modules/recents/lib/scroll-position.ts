export type NativeScrollable = {
  scrollTo: (options: { animated: boolean; x: number; y: number }) => void;
};

export function getRecentHistoryInitialOffset(headerHeight: number, isIOS: boolean) {
  return isIOS ? -headerHeight : 0;
}

/**
 * Legend List clamps imperative `scrollToOffset` calls to its logical range
 * (zero and above). iOS lists need their native negative top-inset offset to
 * rest beneath the shared header, so reset through the exposed ScrollView.
 */
export function resetRecentHistoryScroll(
  scrollView: NativeScrollable | null | undefined,
  offset: number,
) {
  scrollView?.scrollTo({ animated: false, x: 0, y: offset });
}
