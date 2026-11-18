// Value: protects=the data one account caches on a device (articles, history, positions, queued progress) never reaches another account, whether the first one signed out, was revoked, or the device holds data of an unknown owner;
//   fails_when=a different account signs in and still sees or replays what the previous one left, or the same account loses its data on a restart;
//   why_new=nothing tied cached data to an account, so only an explicit sign-out could have cleaned up, and it did not;
//   seam=real stores and query client over an in-memory localStorage, with the API stubbed to fail;
//   no_claim=green does not prove MMKV clearAll on a device or that the session gate runs this before a screen renders (see use-session-gate).
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { createMemoryLocalStorage, installWindowStorage } from "../../../lib/memory-local-storage";
import { mockMobileAuth, mockReactNative } from "../../../lib/module-mocks";
import { recentIds as readRecentIds, seedAccount } from "./account-data";

const fetchMock = mock(
  async (_url: string, _init: RequestInit) => new Response("down", { status: 503 }),
);
const originalFetch = globalThis.fetch;
let consoleError: ReturnType<typeof spyOn>;

mockReactNative();
mockMobileAuth();

const { persister, queryClient } =
  await import("../../../../../../apps/mobile/src/lib/query/client");
const { adoptSessionUser, clearUserData, isSessionOwner } =
  await import("../../../../../../apps/mobile/src/modules/auth/lib/user-data");
const { saveRecentArticle, useRecentArticles } =
  await import("../../../../../../apps/mobile/src/modules/recents/lib/store");
const { readReaderPosition, writeReaderPosition } =
  await import("../../../../../../apps/mobile/src/modules/reader/lib/position");
const { readingProgressSync } =
  await import("../../../../../../apps/mobile/src/modules/reader/lib/progress-store");
const { readThemeMode, saveThemeMode } =
  await import("../../../../../../apps/mobile/src/theme/mode");

const stores = {
  queryClient,
  readingProgressSync,
  saveRecentArticle,
  useRecentArticles,
  writeReaderPosition,
};
const localStorage = createMemoryLocalStorage();
const recentIds = () => readRecentIds(stores);
let restoreWindow: () => void;

/** The account's data survives: the cache, history, position and the queued write. */
async function expectAccountDataKept(id: string) {
  expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
  expect(recentIds()).toEqual([id]);
  expect(readReaderPosition(id)).toBe(7);
  expect(await persister.restoreClient()).toBeDefined();
}

/** Nothing of the account remains, and nothing of it can be sent. */
async function expectAccountDataGone(id: string) {
  expect(queryClient.getQueryCache().getAll()).toEqual([]);
  expect(await persister.restoreClient()).toBeUndefined();
  expect(recentIds()).toEqual([]);
  expect(readReaderPosition(id)).toBeUndefined();

  fetchMock.mockClear();
  fetchMock.mockImplementation(
    async () => new Response(JSON.stringify({ readingProgress: {} }), { status: 200 }),
  );
  expect(await readingProgressSync.retryBuffered()).toBe(0);
  expect(fetchMock).not.toHaveBeenCalled();
}

beforeAll(() => {
  restoreWindow = installWindowStorage(localStorage);
});

afterEach(() => consoleError.mockRestore());

afterAll(() => {
  restoreWindow();
  globalThis.fetch = originalFetch;
});

beforeEach(async () => {
  // The stubbed API failing is expected; the client logs each failure.
  consoleError = spyOn(console, "error").mockImplementation(() => {});
  localStorage.clear();
  queryClient.clear();
  fetchMock.mockImplementation(async () => new Response("down", { status: 503 }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  clearUserData();
});

describe("adoptSessionUser", () => {
  test("keeps the account's data when the same account signs in again, as after a restart", async () => {
    adoptSessionUser("user-a");
    await seedAccount(stores, localStorage, "a1");

    adoptSessionUser("user-a");

    await expectAccountDataKept("a1");
    expect(isSessionOwner("user-a")).toBe(true);
  });

  test("removes the previous account's data when a different account signs in", async () => {
    adoptSessionUser("user-a");
    await seedAccount(stores, localStorage, "a1");
    await expectAccountDataKept("a1");

    adoptSessionUser("user-b");

    await expectAccountDataGone("a1");
    expect(isSessionOwner("user-b")).toBe(true);
    expect(isSessionOwner("user-a")).toBe(false);
  });

  test("removes data of an unknown owner, such as what an older app version left behind", async () => {
    await seedAccount(stores, localStorage, "legacy");

    adoptSessionUser("user-b");

    await expectAccountDataGone("legacy");
    expect(isSessionOwner("user-b")).toBe(true);
  });

  test("a second account can then cache its own data", async () => {
    adoptSessionUser("user-a");
    await seedAccount(stores, localStorage, "a1");
    adoptSessionUser("user-b");

    await seedAccount(stores, localStorage, "b1");

    await expectAccountDataKept("b1");
    expect(readReaderPosition("a1")).toBeUndefined();
  });

  test("does not send a write the previous account had in flight, nor keep it for the new one", async () => {
    adoptSessionUser("user-a");
    let respond: (response: Response) => void = () => undefined;
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => (respond = resolve)));
    const inFlight = readingProgressSync.push("a1", {
      anchor: null,
      clientUpdatedAt: "2026-10-24T12:00:00.000Z",
      completed: false,
      contentKey: "html:none",
      progress: 0.4,
      sessionActiveMs: 4_000,
      sessionId: "session-a",
    });

    adoptSessionUser("user-b");
    respond(new Response("down", { status: 503 }));
    await inFlight;

    await expectAccountDataGone("a1");
  });
});

describe("clearUserData", () => {
  test("forgets the owner, so the same account is treated as new on its next sign-in", async () => {
    adoptSessionUser("user-a");
    await seedAccount(stores, localStorage, "a1");

    clearUserData();

    await expectAccountDataGone("a1");
    expect(isSessionOwner("user-a")).toBe(false);
  });

  test("keeps the theme, which is a device setting", () => {
    saveThemeMode("dark");

    clearUserData();

    expect(readThemeMode()).toBe("dark");
  });
});
