// @vitest-environment jsdom

import {
  QueryClient,
  QueryClientProvider,
} from "../../../../../../../../apps/web/node_modules/@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { OpmlImportStatusDto } from "@lib/schemas";
import type { PlatformState } from "@hooks/use-platform";
import { FollowSourcesDialog } from "@modules/feeds/components/follow/dialog";

const mocks = vi.hoisted(() => ({
  followFeed: vi.fn(),
  getOpmlImportStatus: vi.fn(),
  getOpmlImportUrlCandidate: vi.fn((value: string) => {
    const trimmed = value.trim();
    return trimmed.includes("opml")
      ? /^https?:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`
      : null;
  }),
  getImportedCount: vi.fn((status: OpmlImportStatusDto) => {
    return status.summary.subscribed + status.summary.alreadySubscribed;
  }),
  importOpmlFromUrl: vi.fn(),
  pollOpmlImportStatus: vi.fn(
    async (
      taskId: string,
      options?: {
        onStatus?: (status: OpmlImportStatusDto) => void;
      },
    ) => {
      const nextStatus = await mocks.getOpmlImportStatus({ data: { taskId } });
      options?.onStatus?.(nextStatus);
      return nextStatus;
    },
  ),
  searchFeeds: vi.fn(),
  anchoredToastAdd: vi.fn(),
  toastAdd: vi.fn(),
  toastPromise: vi.fn((promise: Promise<unknown>, _options: unknown) => promise),
  toastUpdate: vi.fn(),
}));

vi.mock("@modules/feeds/lib/api", () => ({
  DISCOVER_SEARCH_RESULT_LIMIT: 50,
  followFeed: mocks.followFeed,
  getOpmlImportStatus: mocks.getOpmlImportStatus,
  importOpmlFromUrl: mocks.importOpmlFromUrl,
  searchFeeds: mocks.searchFeeds,
}));

vi.mock("@modules/feeds/lib/opml", () => ({
  getImportedCount: mocks.getImportedCount,
  getOpmlImportUrlCandidate: mocks.getOpmlImportUrlCandidate,
  pollOpmlImportStatus: mocks.pollOpmlImportStatus,
}));

vi.mock("@kyomi/ui/atoms/toast", () => ({
  anchoredToastManager: {
    add: mocks.anchoredToastAdd,
  },
  toastManager: {
    add: mocks.toastAdd,
    promise: mocks.toastPromise,
    update: mocks.toastUpdate,
  },
}));

vi.mock("@modules/sidebar/components/feed-favicon", () => ({
  FeedFavicon: ({ title }: { title?: string }) => <span>{title}</span>,
}));

vi.mock("@modules/inbox/queries/options", () => ({
  followedFeedsQueryKey: () => ["feeds", "followed"],
  invalidateFeedAndInboxQueries: vi.fn(),
}));

const platform: PlatformState = {
  platform: "mac",
  isMac: true,
  isWindows: false,
  isLinux: false,
  modifierKeyLabel: "\u2318",
  usesMetaModifier: true,
};

function status(
  overrides: Omit<Partial<OpmlImportStatusDto>, "summary"> & {
    summary?: Partial<OpmlImportStatusDto["summary"]>;
  } = {},
): OpmlImportStatusDto {
  return {
    taskId: "task-1",
    status: "completed",
    createdAt: "2026-07-01T00:00:00.000Z",
    completedAt: "2026-07-01T00:00:01.000Z",
    filename: "subscriptions.opml",
    opmlTitle: null,
    opmlAuthor: null,
    message: null,
    ...overrides,
    summary: {
      totalUrls: 2,
      completed: 2,
      subscribed: 1,
      alreadySubscribed: 1,
      failed: 0,
      cancelled: 0,
      failures: [],
      ...overrides.summary,
    },
  };
}

function renderDialog({ onOpenChange = vi.fn() }: { onOpenChange?: (open: boolean) => void } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <FollowSourcesDialog
        enableGlobalShortcut={false}
        open
        platform={platform}
        onOpenChange={onOpenChange}
      />
    </QueryClientProvider>,
  );
  return { ...view, queryClient, onOpenChange };
}

function typeInSearch(value: string) {
  fireEvent.change(screen.getByPlaceholderText("Search feeds or paste a feed URL..."), {
    target: { value },
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe("SourcesDialog OPML import", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: vi.fn(() => []),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    delete (Element.prototype as { getAnimations?: unknown }).getAnimations;
  });

  test("shows the import button for OPML-looking URLs", () => {
    renderDialog();

    typeInSearch("example.com/subscriptions.opml");

    expect(screen.getByRole("button", { name: "Import feeds from OPML" }).textContent).toBe(
      "Import",
    );
    expect(mocks.searchFeeds).not.toHaveBeenCalled();
  });

  test("does not show the import button for generic feed XML URLs", () => {
    renderDialog();

    typeInSearch("https://example.com/feed.xml");

    expect(screen.queryByRole("button", { name: "Import feeds from OPML" })).toBeNull();
  });

  test("starts the import, updates progress, and invalidates sidebar data", async () => {
    const finalStatus = status();
    const onOpenChange = vi.fn();
    mocks.importOpmlFromUrl.mockResolvedValue({ taskId: "task-1" });
    mocks.getOpmlImportStatus.mockResolvedValue(finalStatus);
    const { queryClient } = renderDialog({ onOpenChange });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    typeInSearch("https://example.com/subscriptions.opml");
    fireEvent.click(screen.getByRole("button", { name: "Import feeds from OPML" }));

    await waitFor(() => {
      expect(mocks.importOpmlFromUrl).toHaveBeenCalledWith({
        data: { url: "https://example.com/subscriptions.opml" },
      });
    });
    await waitFor(() => {
      expect(mocks.getOpmlImportStatus).toHaveBeenCalledWith({ data: { taskId: "task-1" } });
    });
    expect(mocks.toastUpdate).toHaveBeenCalledWith(
      expect.stringMatching(/^opml-import-/),
      expect.objectContaining({
        title: "2 of 2 feeds imported.",
        data: {
          progress: {
            value: 2,
            max: 2,
            label: "OPML import progress",
          },
        },
      }),
    );
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["folders"] });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    const [, toastOptions] = mocks.toastPromise.mock.calls[0] as unknown as [
      Promise<unknown>,
      {
        loading: { timeout: number };
        success: (status: OpmlImportStatusDto) => {
          title: string;
          timeout: number;
        };
        error: (error: unknown) => {
          title: string;
          timeout: number;
        };
      },
    ];
    expect(toastOptions.loading.timeout).toBe(0);
    expect(toastOptions.success(finalStatus).title).toBe("Imported 2 of 2 feeds");
    expect(toastOptions.success(finalStatus).timeout).toBe(3000);
    expect(toastOptions.error(new Error("failed")).timeout).toBe(7000);
  });
});

describe("SourcesDialog feed follow", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: vi.fn(() => []),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    delete (Element.prototype as { getAnimations?: unknown }).getAnimations;
  });

  test("shows the anchored followed toast from the command action", async () => {
    const followResult = {
      feedId: "feed-1",
      title: "Example Feed",
      url: "https://example.com/feed.xml",
    };
    const follow = createDeferred<typeof followResult>();
    mocks.searchFeeds.mockResolvedValue([
      {
        id: "feed-1",
        title: "Example Feed",
        url: "https://example.com/feed.xml",
        link: "https://example.com",
        description: "Example feed description",
        faviconUrl: null,
        isSubscribed: false,
      },
    ]);
    mocks.followFeed.mockReturnValue(follow.promise);

    renderDialog();

    typeInSearch("example");

    await screen.findByRole("option", { name: /Example Feed/ });
    const action = screen.getByRole("button", { name: "Add feed" });
    fireEvent.click(action);

    await waitFor(() => {
      expect(mocks.followFeed).toHaveBeenCalledWith({
        data: { feedId: "feed-1", url: "https://example.com/feed.xml" },
      });
    });
    expect(mocks.anchoredToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Following!",
        positionerProps: expect.objectContaining({
          anchor: action,
          side: "top",
        }),
      }),
    );

    follow.resolve(followResult);
  });
});
