// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FollowSourcesCommand } from "@modules/feeds/components/follow/command";
import type { DiscoverFeedResult } from "@modules/feeds/lib/api";

vi.mock("@modules/sidebar/components/feed-favicon", () => ({
  FeedFavicon: ({ title }: { title?: string }) => <span>{title}</span>,
}));

const feed: DiscoverFeedResult = {
  id: "feed-1",
  title: "Biology Notes",
  url: "https://example.com/feed.xml",
  link: "https://example.com",
  description: "Research notes",
  faviconUrl: null,
  isSubscribed: false,
};

describe("FollowSourcesCommand", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  test("shows follow feedback when adding a feed from the action button", () => {
    vi.useFakeTimers();
    const onFollowFeed = vi.fn();

    render(
      <FollowSourcesCommand
        isPendingFollow={() => false}
        opmlImportUrl={null}
        pendingOpmlImportUrl={null}
        query="bio"
        state={{
          kind: "search",
          results: [feed],
          resultsCount: 1,
          showEmpty: false,
          showLoading: false,
          truncated: false,
        }}
        onFollowFeed={onFollowFeed}
        onQueryChange={vi.fn()}
        onStartOpmlImport={vi.fn()}
      />,
    );

    const addButton = screen.getByRole("button", { name: "Add feed" });
    fireEvent.click(addButton);

    expect(onFollowFeed).toHaveBeenCalledWith(feed, addButton);
    expect((screen.getByRole("button", { name: "Following" }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect((screen.getByRole("button", { name: "Add feed" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
