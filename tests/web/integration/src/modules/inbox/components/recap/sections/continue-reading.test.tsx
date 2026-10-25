// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ContinueReading } from "@modules/inbox/components/recap/sections/continue-reading";
import { resetReportedImpressions } from "@modules/inbox/hooks/use-impressions";
import type { InboxItem } from "@modules/articles/lib/api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="/inbox/a">{children}</a>,
}));

vi.mock("@modules/articles/lib/api", () => ({
  reportContinueReadingImpressions: vi.fn(() => Promise.resolve({ message: "ok" })),
}));

function item(id: string, overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id,
    title: `Article ${id}`,
    summary: null,
    link: `https://example.com/${id}`,
    publishedAt: "2026-07-01T00:00:00.000Z",
    feedId: "feed-1",
    feedFaviconUrl: null,
    feedUrl: null,
    feedSiteUrl: null,
    feedTitle: "Example Feed",
    articleType: "feed",
    isRead: true,
    isSaved: false,
    categories: [],
    readingProgress: {
      progress: 0.4,
      maxProgress: 0.4,
      state: "reading",
      engaged: true,
      remainingMinutes: 6,
      lastReadAt: "2026-07-02T00:00:00.000Z",
      completedAt: null,
    },
    ...overrides,
  };
}

describe("ContinueReading", () => {
  beforeEach(() => {
    resetReportedImpressions();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  test("renders nothing when there are no articles", () => {
    const { container } = render(<ContinueReading items={[]} onDismiss={vi.fn()} />);

    expect(container.firstChild).toBeNull();
  });

  test("lists each article with its feed and the time left", () => {
    render(<ContinueReading items={[item("a")]} onDismiss={vi.fn()} />);

    expect(screen.getByText("Continue reading")).toBeTruthy();
    expect(screen.getByText("Article a")).toBeTruthy();
    expect(screen.getByText("Example Feed · 6 min left")).toBeTruthy();
  });

  test("shows only the feed when the time left is unknown", () => {
    const row = item("a");
    render(
      <ContinueReading
        items={[{ ...row, readingProgress: { ...row.readingProgress!, remainingMinutes: null } }]}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("Example Feed")).toBeTruthy();
  });

  test("dismisses the article from its row", () => {
    const onDismiss = vi.fn();
    render(<ContinueReading items={[item("a"), item("b")]} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss Article b" }));

    expect(onDismiss).toHaveBeenCalledExactlyOnceWith("b");
  });

  test("keeps the rail quiet by showing at most two rows", () => {
    render(
      <ContinueReading items={[item("a"), item("b"), item("c"), item("d")]} onDismiss={vi.fn()} />,
    );

    expect(screen.getAllByRole("button", { name: /^Dismiss / })).toHaveLength(2);
  });
});
