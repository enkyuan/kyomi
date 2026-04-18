import { useFeedRefresh } from "@hooks/use-feed-refresh";
import { Refresh2Fill } from "@mingcute/react";

export function FeedRefreshStatus({ feedId }: { feedId: string }) {
  const { refresh, isRefreshing } = useFeedRefresh(feedId);

  return (
    <button
      type="button"
      disabled={isRefreshing}
      onClick={(e) => {
        e.preventDefault();
        refresh();
      }}
      className="inline-flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
      aria-label="Refresh feed"
      title="Refresh feed"
    >
      <Refresh2Fill className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
    </button>
  );
}
