// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "../../../../../../../apps/web/node_modules/@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { READING_FLUSH_INTERVAL_MS, scrollTopForProgress } from "@kyomi/reader/core";
import type {
  ReadingPositionDto,
  ReadingProgressDto,
  ReadingProgressUpdateBody,
} from "@kyomi/reader/schemas/article";
import { useReadingProgress } from "@modules/reader/hooks/use-reading-progress";
import { queryKeys } from "@lib/query/keys";

const { measureReaderBody, findReaderBody, saveReadingProgress } = vi.hoisted(() => ({
  measureReaderBody: vi.fn(),
  findReaderBody: vi.fn(),
  saveReadingProgress: vi.fn(),
}));

vi.mock("@modules/reader/lib/progress", () => ({ measureReaderBody, findReaderBody }));
vi.mock("@modules/articles/lib/api", () => ({ saveReadingProgress }));

const serverProgress: ReadingProgressDto = {
  progress: 0.25,
  maxProgress: 0.25,
  state: "reading",
  engaged: true,
  remainingMinutes: 7,
  lastReadAt: "2026-07-02T00:00:00.000Z",
  completedAt: null,
};

const layout = { viewportHeight: 800, contentTop: 100, contentHeight: 2_000 };

function metrics(scrollTop: number, endVisible = false) {
  return { ...layout, scrollTop, endVisible };
}

function position(overrides: Partial<ReadingPositionDto> = {}): ReadingPositionDto {
  return {
    progress: 0.5,
    anchor: null,
    contentKey: "feed_html:none",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

let visibility: DocumentVisibilityState = "visible";
let queryClient: QueryClient;
let viewport: HTMLDivElement;
let scrollTo: ReturnType<typeof vi.fn>;

type HookProps = Parameters<typeof useReadingProgress>[0];

function renderProgress(overrides: Partial<Omit<HookProps, "viewportRef">> = {}) {
  const initial = {
    itemId: "a",
    contentKey: "feed_html:none",
    readingPosition: null,
    enabled: true,
    ...overrides,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  // A component keeps one ref object for its lifetime; so does the hook under test.
  const viewportRef = { current: viewport };
  return renderHook(
    (props: Omit<HookProps, "viewportRef">) => useReadingProgress({ ...props, viewportRef }),
    { initialProps: initial, wrapper },
  );
}

async function scrollTo_(scrollTop: number, endVisible = false) {
  measureReaderBody.mockReturnValue(metrics(scrollTop, endVisible));
  viewport.dispatchEvent(new Event("scroll"));
  await vi.advanceTimersByTimeAsync(20);
}

function sentBodies(): ReadingProgressUpdateBody[] {
  return saveReadingProgress.mock.calls.map(([arg]) => arg.data.body);
}

describe("useReadingProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    viewport = document.createElement("div");
    scrollTo = vi.fn();
    viewport.scrollTo = scrollTo as unknown as typeof viewport.scrollTo;
    document.body.append(viewport);
    measureReaderBody.mockReset();
    measureReaderBody.mockReturnValue(metrics(0));
    findReaderBody.mockReset();
    findReaderBody.mockReturnValue(null);
    saveReadingProgress.mockReset();
    saveReadingProgress.mockResolvedValue({ readingProgress: serverProgress });
  });

  afterEach(() => {
    viewport.remove();
    vi.useRealTimers();
  });

  describe("tracking", () => {
    test("sends nothing until the reader has scrolled", async () => {
      renderProgress();

      await vi.advanceTimersByTimeAsync(READING_FLUSH_INTERVAL_MS * 3);

      expect(saveReadingProgress).not.toHaveBeenCalled();
    });

    test("flushes the sampled position every interval while the reader is active", async () => {
      renderProgress();
      await scrollTo_(400);

      await vi.advanceTimersByTimeAsync(READING_FLUSH_INTERVAL_MS);

      expect(saveReadingProgress).toHaveBeenCalledTimes(1);
      const [call] = saveReadingProgress.mock.calls[0];
      expect(call.data.itemId).toBe("a");
      // Reading line: (400 + 800 * 0.25 - 100) / 2000
      expect(call.data.body).toMatchObject({
        progress: 0.25,
        anchor: null,
        contentKey: "feed_html:none",
        completed: false,
      });
      expect(call.data.body.sessionActiveMs).toBeGreaterThan(0);
      expect(call.fetch).toBeUndefined();
    });

    test("stops sending once the reader goes idle", async () => {
      renderProgress();
      await scrollTo_(400);

      await vi.advanceTimersByTimeAsync(READING_FLUSH_INTERVAL_MS * 8);

      // Active time stops growing after the idle timeout, so later ticks have nothing new.
      expect(saveReadingProgress).toHaveBeenCalledTimes(3);
    });

    test("keeps one session id and a cumulative active time across flushes", async () => {
      renderProgress();
      await scrollTo_(400);
      await vi.advanceTimersByTimeAsync(READING_FLUSH_INTERVAL_MS * 2);

      const [first, second] = sentBodies();
      expect(second.sessionId).toBe(first.sessionId);
      expect(second.sessionActiveMs).toBeGreaterThan(first.sessionActiveMs);
    });

    test("reports completion when the end of the article is visible", async () => {
      renderProgress();
      await scrollTo_(1_500, true);

      await vi.advanceTimersByTimeAsync(READING_FLUSH_INTERVAL_MS);

      expect(sentBodies()[0].completed).toBe(true);
    });

    test("flushes when the page becomes hidden, with a request that outlives the page", async () => {
      renderProgress();
      await scrollTo_(400);

      visibility = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));

      expect(saveReadingProgress).toHaveBeenCalledTimes(1);
      const [call] = saveReadingProgress.mock.calls[0];
      expect(call.fetch).toBeTypeOf("function");
    });

    test("does not flush on the timer while the page is hidden", async () => {
      renderProgress();
      await scrollTo_(400);
      visibility = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
      saveReadingProgress.mockClear();

      await vi.advanceTimersByTimeAsync(READING_FLUSH_INTERVAL_MS * 3);

      expect(saveReadingProgress).not.toHaveBeenCalled();
    });

    test("flushes on unmount", async () => {
      const { unmount } = renderProgress();
      await scrollTo_(400);

      unmount();

      expect(saveReadingProgress).toHaveBeenCalledTimes(1);
      expect(saveReadingProgress.mock.calls[0][0].data.itemId).toBe("a");
    });

    test("flushes the old article and starts a new session when the article changes", async () => {
      const { rerender } = renderProgress();
      await scrollTo_(400);

      rerender({ itemId: "b", contentKey: "feed_html:none", readingPosition: null, enabled: true });

      expect(saveReadingProgress).toHaveBeenCalledTimes(1);
      expect(saveReadingProgress.mock.calls[0][0].data.itemId).toBe("a");

      await scrollTo_(600);
      await vi.advanceTimersByTimeAsync(READING_FLUSH_INTERVAL_MS);

      const lastCall = saveReadingProgress.mock.calls.at(-1)?.[0];
      expect(lastCall.data.itemId).toBe("b");
      expect(lastCall.data.body.sessionId).not.toBe(sentBodies()[0].sessionId);
    });

    test("sends nothing when remembering the position is off", async () => {
      const { unmount } = renderProgress({ enabled: false });
      await scrollTo_(400);
      await vi.advanceTimersByTimeAsync(READING_FLUSH_INTERVAL_MS * 3);
      visibility = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
      unmount();

      expect(saveReadingProgress).not.toHaveBeenCalled();
    });

    test("swallows a failed write and sends the next one", async () => {
      saveReadingProgress.mockRejectedValueOnce(new Error("offline"));
      renderProgress();
      await scrollTo_(400);

      await vi.advanceTimersByTimeAsync(READING_FLUSH_INTERVAL_MS * 2);

      expect(saveReadingProgress).toHaveBeenCalledTimes(2);
    });

    test("updates cached list rows and the cached detail after a flush", async () => {
      queryClient.setQueryData(queryKeys.inbox.items, {
        pages: [
          {
            items: [
              { id: "a", readingProgress: null },
              { id: "b", readingProgress: null },
            ],
          },
        ],
        pageParams: [undefined],
      });
      queryClient.setQueryData(queryKeys.inbox.itemDetail("a"), {
        item: { id: "a", readingProgress: null, readingPosition: null },
      });
      renderProgress();
      await scrollTo_(400);

      await vi.advanceTimersByTimeAsync(READING_FLUSH_INTERVAL_MS);

      const list = queryClient.getQueryData<{
        pages: Array<{ items: Array<{ id: string; readingProgress: unknown }> }>;
      }>(queryKeys.inbox.items);
      expect(list?.pages[0].items[0].readingProgress).toEqual(serverProgress);
      expect(list?.pages[0].items[1].readingProgress).toBeNull();

      const detail = queryClient.getQueryData<{
        item: { readingProgress: unknown; readingPosition: ReadingPositionDto };
      }>(queryKeys.inbox.itemDetail("a"));
      expect(detail?.item.readingProgress).toEqual(serverProgress);
      expect(detail?.item.readingPosition).toMatchObject({
        progress: 0.25,
        contentKey: "feed_html:none",
      });
    });
  });

  describe("restore", () => {
    const restoredTop = scrollTopForProgress(0.5, layout);

    test("opens at the top when there is no stored position", () => {
      renderProgress();

      expect(scrollTo.mock.calls).toEqual([[{ top: 0 }]]);
    });

    test("scrolls to the stored position when the content key matches", () => {
      renderProgress({ readingPosition: position() });

      expect(scrollTo).toHaveBeenLastCalledWith({ top: restoredTop });
      expect(restoredTop).toBeGreaterThan(0);
    });

    test("opens at the top when the stored content key differs", () => {
      renderProgress({ readingPosition: position({ contentKey: "feed_html:v2" }) });

      expect(scrollTo.mock.calls).toEqual([[{ top: 0 }]]);
    });

    test("opens at the top when remembering the position is off", () => {
      renderProgress({ readingPosition: position(), enabled: false });

      expect(scrollTo.mock.calls).toEqual([[{ top: 0 }]]);
    });

    test("waits for the body to lay out before restoring", async () => {
      measureReaderBody.mockReturnValue(null);
      renderProgress({ readingPosition: position() });
      expect(scrollTo).toHaveBeenCalledTimes(1);

      measureReaderBody.mockReturnValue(metrics(0));
      await vi.advanceTimersByTimeAsync(40);

      expect(scrollTo).toHaveBeenLastCalledWith({ top: restoredTop });
    });

    test("re-applies once after images settle", async () => {
      renderProgress({ readingPosition: position() });
      scrollTo.mockClear();

      // The page grew while images loaded.
      measureReaderBody.mockReturnValue({ ...metrics(restoredTop), contentHeight: 3_000 });
      const image = document.createElement("img");
      viewport.append(image);
      image.dispatchEvent(new Event("load"));
      await vi.advanceTimersByTimeAsync(200);

      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({
        top: scrollTopForProgress(0.5, { ...layout, contentHeight: 3_000 }),
      });

      image.dispatchEvent(new Event("load"));
      await vi.advanceTimersByTimeAsync(500);
      expect(scrollTo).toHaveBeenCalledTimes(1);
    });

    test("does not re-apply after the reader has scrolled", async () => {
      renderProgress({ readingPosition: position() });
      scrollTo.mockClear();

      viewport.dispatchEvent(new Event("wheel"));
      const image = document.createElement("img");
      viewport.append(image);
      image.dispatchEvent(new Event("load"));
      await vi.advanceTimersByTimeAsync(500);

      expect(scrollTo).not.toHaveBeenCalled();
    });

    test("does not restore again when only the stored position changes while open", () => {
      const { rerender } = renderProgress({ readingPosition: position() });
      scrollTo.mockClear();

      rerender({
        itemId: "a",
        contentKey: "feed_html:none",
        readingPosition: position({ progress: 0.8 }),
        enabled: true,
      });

      expect(scrollTo).not.toHaveBeenCalled();
    });
  });
});
