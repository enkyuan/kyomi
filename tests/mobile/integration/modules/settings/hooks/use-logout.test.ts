// Value: protects=signing out removes the previous account's cached articles, reading history, reading position and queued progress writes from memory and from the device, also when the sign-out request fails after the client already dropped the local session;
//   fails_when=logout leaves any of those behind, so the next account on the device sees them or replays them under its own session;
//   why_new=useLogout only called signOut, so every persisted store survived a sign-out and nothing tested it;
//   seam=real stores and real query client over an in-memory localStorage, with the auth client and the network stubbed;
//   no_claim=green does not prove MMKV clearAll on a device or that the Better Auth cookie is cleared (that is the auth client's job).
import { mockOfflineSqlite } from "../../../lib/offline-sqlite";
mockOfflineSqlite();
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
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryLocalStorage, installWindowStorage } from "../../../lib/memory-local-storage";
import { mockMobileAuth, mockReactNative } from "../../../lib/module-mocks";
import { recentIds as readRecentIds, seedAccount } from "../../auth/lib/account-data";

type AlertButton = { onPress?: () => void; style?: string; text?: string };

const alertSpy = mock((_title: string, _message: string, _buttons: AlertButton[]) => undefined);
const signOut = mock(async (): Promise<{ error: unknown }> => ({ error: null }));
const fetchMock = mock(
  async (_url: string, _init: RequestInit) => new Response("down", { status: 503 }),
);
const originalFetch = globalThis.fetch;
let consoleError: ReturnType<typeof spyOn>;

mockReactNative({ Alert: { alert: alertSpy } });
mockMobileAuth({ signOut });

const { queryClient, persister } =
  await import("../../../../../../apps/mobile/src/lib/query/client");
const { useLogout } =
  await import("../../../../../../apps/mobile/src/modules/settings/hooks/use-logout");
const { adoptSessionUser, isSessionOwner } =
  await import("../../../../../../apps/mobile/src/modules/auth/lib/user-data");
const { saveRecentArticle, useRecentArticles } =
  await import("../../../../../../apps/mobile/src/modules/recents/lib/store");
const { readReaderPosition, writeReaderPosition } =
  await import("../../../../../../apps/mobile/src/modules/reader/lib/position");
const { readingProgressSync } =
  await import("../../../../../../apps/mobile/src/modules/reader/lib/progress-store");
const { readThemeMode, saveThemeMode } =
  await import("../../../../../../apps/mobile/src/theme/mode");

const localStorage = createMemoryLocalStorage();
let restoreWindow: () => void;

const recentIds = () => readRecentIds(stores);
const stores = {
  persister,
  queryClient,
  readingProgressSync,
  saveRecentArticle,
  useRecentArticles,
  writeReaderPosition,
};

function mountLogout() {
  let hook: ReturnType<typeof useLogout> | undefined;
  function Probe() {
    hook = useLogout();
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  if (!hook) throw new Error("the hook did not render");
  return hook;
}

/** Taps "Log out" and confirms the alert. */
async function confirmLogout() {
  mountLogout().confirmLogout();
  const buttons = alertSpy.mock.calls.at(-1)?.[2] ?? [];
  buttons.find((button) => button.style === "destructive")?.onPress?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeAll(() => {
  restoreWindow = installWindowStorage(localStorage);
});

afterAll(() => {
  restoreWindow();
  globalThis.fetch = originalFetch;
});

beforeEach(async () => {
  // The stubbed API failing is expected; the client logs each failure.
  consoleError = spyOn(console, "error").mockImplementation(() => {});
  localStorage.clear();
  queryClient.clear();
  signOut.mockClear();
  signOut.mockImplementation(async () => ({ error: null }));
  alertSpy.mockClear();
  fetchMock.mockClear();
  fetchMock.mockImplementation(async () => new Response("down", { status: 503 }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  adoptSessionUser("user-a");
  await seedAccount(stores, localStorage, "a1");
});

afterEach(() => {
  consoleError.mockRestore();
  queryClient.clear();
});

describe("logging out", () => {
  test("leaves nothing of the previous account in memory or on the device", async () => {
    expect(recentIds()).toEqual(["a1"]);
    expect(readReaderPosition("a1")).toBe(7);

    await confirmLogout();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(await persister.restoreClient()).toBeUndefined();
    expect(recentIds()).toEqual([]);
    expect(readReaderPosition("a1")).toBeUndefined();
    expect(
      [...localStorage.raw.keys()].filter((key) => !key.startsWith("kyomi:appearance:")),
    ).toEqual([]);
  });

  test("does not replay the previous account's queued progress under the next session", async () => {
    fetchMock.mockClear();

    await confirmLogout();
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ readingProgress: {} }), { status: 200 }),
    );
    const sent = await readingProgressSync.retryBuffered();

    expect(sent).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("keeps the device preference that is not the account's data", async () => {
    saveThemeMode("dark");

    await confirmLogout();

    expect(readThemeMode()).toBe("dark");
  });

  test("leaves nothing behind when the sign-out request fails: the client already dropped the session", async () => {
    signOut.mockImplementation(async () => ({ error: { message: "offline", status: 503 } }));

    await confirmLogout();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(recentIds()).toEqual([]);
    expect(readReaderPosition("a1")).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(await persister.restoreClient()).toBeUndefined();
    expect(isSessionOwner("user-a")).toBe(false);
  });

  test("leaves nothing behind when the sign-out request rejects", async () => {
    signOut.mockImplementation(async () => {
      throw new Error("network down");
    });

    await confirmLogout();

    expect(recentIds()).toEqual([]);
    expect(readReaderPosition("a1")).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(await persister.restoreClient()).toBeUndefined();
    expect(isSessionOwner("user-a")).toBe(false);
  });

  test("does not replay queued progress under the next session after a failed sign-out", async () => {
    signOut.mockImplementation(async () => {
      throw new Error("network down");
    });
    await confirmLogout();
    fetchMock.mockClear();
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ readingProgress: {} }), { status: 200 }),
    );

    expect(await readingProgressSync.retryBuffered()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
