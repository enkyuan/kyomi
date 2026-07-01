import { describe, expect, test, vi } from "vitest";
import {
  getImportedCount,
  getOpmlImportUrlCandidate,
  isTerminalOpmlImportStatus,
  pollOpmlImportStatus,
} from "@modules/feeds/opml-import";
import type { OpmlImportStatusDto } from "@lib/schemas";

function status(
  overrides: Partial<OpmlImportStatusDto> & {
    summary?: Partial<OpmlImportStatusDto["summary"]>;
  } = {},
): OpmlImportStatusDto {
  return {
    taskId: "task-1",
    status: "pending",
    createdAt: "2026-07-01T00:00:00.000Z",
    completedAt: null,
    filename: "subscriptions.opml",
    opmlTitle: null,
    opmlAuthor: null,
    message: null,
    ...overrides,
    summary: {
      totalUrls: 3,
      completed: 0,
      subscribed: 0,
      alreadySubscribed: 0,
      failed: 0,
      cancelled: 0,
      failures: [],
      ...overrides.summary,
    },
  };
}

describe("OPML import helpers", () => {
  test("detects OPML import URLs without matching generic feed XML URLs", () => {
    expect(getOpmlImportUrlCandidate("example.com/subscriptions.opml")).toBe(
      "https://example.com/subscriptions.opml",
    );
    expect(getOpmlImportUrlCandidate("https://example.com/export?format=opml")).toBe(
      "https://example.com/export?format=opml",
    );
    expect(getOpmlImportUrlCandidate("https://example.com/feed.xml")).toBeNull();
    expect(getOpmlImportUrlCandidate("not a url")).toBeNull();
  });

  test("identifies terminal statuses and imported counts", () => {
    expect(isTerminalOpmlImportStatus("pending")).toBe(false);
    expect(isTerminalOpmlImportStatus("in_progress")).toBe(false);
    expect(isTerminalOpmlImportStatus("completed")).toBe(true);
    expect(isTerminalOpmlImportStatus("failed")).toBe(true);
    expect(isTerminalOpmlImportStatus("cancelled")).toBe(true);
    expect(getImportedCount(status({ summary: { subscribed: 2, alreadySubscribed: 1 } }))).toBe(3);
  });

  test("polls until a terminal status and reports intermediate progress", async () => {
    const pending = status({
      status: "in_progress",
      summary: { totalUrls: 2, completed: 1, subscribed: 1 },
    });
    const completed = status({
      status: "completed",
      completedAt: "2026-07-01T00:00:01.000Z",
      summary: { totalUrls: 2, completed: 2, subscribed: 1, alreadySubscribed: 1 },
    });
    const getStatus = vi.fn().mockResolvedValueOnce(pending).mockResolvedValueOnce(completed);
    const onStatus = vi.fn();

    const result = await pollOpmlImportStatus("task-1", {
      intervalMs: 0,
      getStatus,
      onStatus,
    });

    expect(result).toBe(completed);
    expect(getStatus).toHaveBeenCalledTimes(2);
    expect(onStatus).toHaveBeenNthCalledWith(1, pending);
    expect(onStatus).toHaveBeenNthCalledWith(2, completed);
  });
});
