import KyomiNativeHeaderView from "../../../../../modules/header/src/KyomiNativeHeaderView";

type InboxNativeHeaderProps = {
  collapseProgress: number;
  topInset: number;
};

export function InboxNativeHeader({ collapseProgress, topInset }: InboxNativeHeaderProps) {
  return (
    <KyomiNativeHeaderView
      collapseProgress={collapseProgress}
      pointerEvents="none"
      style={{ height: topInset + 89, left: 0, position: "absolute", right: 0, top: 0, zIndex: 1 }}
      title="Inbox"
      topInset={topInset}
    />
  );
}
