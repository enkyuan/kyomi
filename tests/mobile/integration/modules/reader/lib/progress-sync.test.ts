// Value: protects=reading progress that could not be sent is kept (latest body per article) and retried;
//   fails_when=a failed write is lost, an older body replaces a newer one, a permanent rejection is retried forever, or a retry resends what already succeeded;
//   why_new=no mobile test covers the offline buffer or its retry order;
//   seam=in-memory AppStorage and an injected transport, so no network or MMKV is involved;
//   no_claim=green does not prove MMKV persistence or the AppState foreground trigger.
import { describe, expect, test } from "bun:test";
import type { AppStorage } from "../../../../../../apps/mobile/src/lib/storage";
import {
  MAX_BUFFERED_AGE_MS,
  MAX_BUFFERED_ARTICLES,
  createProgressBuffer,
  type ProgressUpdate,
} from "../../../../../../apps/mobile/src/modules/reader/lib/progress-buffer";
import {
  createProgressSync,
  isPermanentFailure,
  type ReadingProgressResult,
} from "../../../../../../apps/mobile/src/modules/reader/lib/progress-sync";

const memoryStorage = (): AppStorage & { raw: Map<string, string> } => {
  const raw = new Map<string, string>();
  return {
    getString: (key) => raw.get(key),
    raw,
    remove: (key) => void raw.delete(key),
    set: (key, value) => void raw.set(key, value),
  };
};

const at = (minute: number) => new Date(Date.UTC(2026, 9, 24, 12, minute)).toISOString();

const body = (minute: number, overrides: Partial<ProgressUpdate> = {}): ProgressUpdate => ({
  anchor: null,
  clientUpdatedAt: at(minute),
  completed: false,
  contentKey: "html:none",
  progress: minute / 100,
  sessionActiveMs: minute * 1000,
  sessionId: "session-1",
  ...overrides,
});

const accepted: ReadingProgressResult = {
  completedAt: null,
  engaged: true,
  lastReadAt: at(0),
  maxProgress: 0.5,
  progress: 0.5,
  remainingMinutes: 4,
  state: "reading",
};

const failure = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

describe("progress buffer", () => {
  test("keeps only the latest body for an article", () => {
    const buffer = createProgressBuffer(memoryStorage());

    buffer.put("a", body(10));
    buffer.put("a", body(20));
    buffer.put("b", body(5));

    expect(buffer.list().map((entry) => [entry.articleId, entry.body.progress])).toEqual([
      ["a", 0.2],
      ["b", 0.05],
    ]);
  });

  test("ignores a body older than the one it already holds", () => {
    const buffer = createProgressBuffer(memoryStorage());

    buffer.put("a", body(20));
    buffer.put("a", body(10));

    expect(buffer.list()[0]?.body.progress).toBe(0.2);
  });

  test("survives a restart because it lives in storage", () => {
    const storage = memoryStorage();
    createProgressBuffer(storage).put("a", body(10));

    expect(createProgressBuffer(storage).list()).toHaveLength(1);
  });

  test("removes an article's write once it, or a newer one, was sent, but not an unsent newer one", () => {
    const buffer = createProgressBuffer(memoryStorage());

    buffer.put("a", body(20));
    buffer.remove("a", body(10));
    expect(buffer.list()).toHaveLength(1);

    buffer.remove("a", body(20));
    expect(buffer.list()).toHaveLength(0);
  });

  test("drops writes older than the retention window and the oldest beyond the cap", () => {
    let now = 1_000_000;
    const buffer = createProgressBuffer(memoryStorage(), () => now);

    buffer.put("stale", body(1));
    now += MAX_BUFFERED_AGE_MS + 1;
    expect(buffer.list()).toEqual([]);

    for (let index = 0; index < MAX_BUFFERED_ARTICLES + 3; index += 1) {
      now += 1;
      buffer.put(`article-${index}`, body(1));
    }
    const ids = buffer.list().map((entry) => entry.articleId);
    expect(ids).toHaveLength(MAX_BUFFERED_ARTICLES);
    expect(ids[0]).toBe("article-3");
  });

  test("treats unreadable storage as empty", () => {
    const storage = memoryStorage();
    storage.set("pending", "{not json");

    expect(createProgressBuffer(storage).list()).toEqual([]);
  });
});

describe("progress sync", () => {
  test("returns the server's progress and keeps nothing when the write succeeds", async () => {
    const buffer = createProgressBuffer(memoryStorage());
    const sync = createProgressSync({ buffer, send: async () => accepted });

    expect(await sync.push("a", body(10))).toEqual(accepted);
    expect(buffer.list()).toEqual([]);
  });

  test("keeps a write that fails on the network and retries it on the next foreground", async () => {
    const buffer = createProgressBuffer(memoryStorage());
    const sent: Array<[string, number]> = [];
    let online = false;
    const sync = createProgressSync({
      buffer,
      send: async (articleId, update) => {
        if (!online) throw failure(0);
        sent.push([articleId, update.progress]);
        return accepted;
      },
    });

    expect(await sync.push("a", body(10))).toBeNull();
    expect(await sync.push("a", body(30))).toBeNull();
    expect(buffer.list().map((entry) => entry.body.progress)).toEqual([0.3]);

    online = true;
    expect(await sync.retryBuffered()).toBe(1);
    expect(sent).toEqual([["a", 0.3]]);
    expect(buffer.list()).toEqual([]);
  });

  test("retries oldest first and stops at the first failure that may pass later", async () => {
    let now = 0;
    const buffer = createProgressBuffer(memoryStorage(), () => (now += 1));
    buffer.put("a", body(10));
    buffer.put("b", body(10));
    buffer.put("c", body(10));
    const attempts: string[] = [];
    const sync = createProgressSync({
      buffer,
      send: async (articleId) => {
        attempts.push(articleId);
        if (articleId === "b") throw failure(503);
        return accepted;
      },
    });

    expect(await sync.retryBuffered()).toBe(1);
    expect(attempts).toEqual(["a", "b"]);
    expect(buffer.list().map((entry) => entry.articleId)).toEqual(["b", "c"]);
  });

  test("drops a write the server will never accept and keeps retrying the rest", async () => {
    const buffer = createProgressBuffer(memoryStorage());
    buffer.put("gone", body(10));
    buffer.put("kept", body(10));
    const sync = createProgressSync({
      buffer,
      send: async (articleId) => {
        if (articleId === "gone") throw failure(404);
        return accepted;
      },
    });

    expect(await sync.retryBuffered()).toBe(1);
    expect(buffer.list()).toEqual([]);
  });

  test("a newer write that succeeds clears an older kept one", async () => {
    const buffer = createProgressBuffer(memoryStorage());
    buffer.put("a", body(10));
    const sync = createProgressSync({ buffer, send: async () => accepted });

    await sync.push("a", body(30));

    expect(buffer.list()).toEqual([]);
  });

  test("a retry that runs while another is in flight shares it", async () => {
    const buffer = createProgressBuffer(memoryStorage());
    buffer.put("a", body(10));
    let calls = 0;
    const sync = createProgressSync({
      buffer,
      send: async () => {
        calls += 1;
        return accepted;
      },
    });

    const [first, second] = await Promise.all([sync.retryBuffered(), sync.retryBuffered()]);

    expect([first, second, calls]).toEqual([1, 1, 1]);
  });
});

describe("isPermanentFailure", () => {
  test("separates rejections that can never succeed from ones worth retrying", () => {
    expect([400, 403, 404, 422].map((status) => isPermanentFailure(failure(status)))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(
      [0, 401, 408, 429, 500, 503].map((status) => isPermanentFailure(failure(status))),
    ).toEqual([false, false, false, false, false, false]);
    expect(isPermanentFailure(new Error("offline"))).toBe(false);
  });
});
