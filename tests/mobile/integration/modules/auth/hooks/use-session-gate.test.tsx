// Value: protects=the app shows signed-in screens only after the cached data belongs to the signed-in account, and a failed or missing session never wipes the data of an account that is still signed in;
//   fails_when=a different account's first render can read the previous account's cache, the same account flashes a pending screen on every start, or a transient auth error destroys the offline queue;
//   why_new=the gate only mirrored the session, so a user switch that skipped sign-out exposed the previous account's data;
//   seam=the real hook and real stores, with the auth client's session stubbed and effects run in jsdom;
//   no_claim=green does not prove the router swaps stacks as the gate flips or how long the blank frame lasts on a device.
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
import { createDomPage } from "../../../lib/dom-page";
import { createMemoryLocalStorage, installWindowStorage } from "../../../lib/memory-local-storage";
import { mockMobileAuth, mockReactNative } from "../../../lib/module-mocks";
import { recentIds as readRecentIds, seedAccount } from "../lib/account-data";

type Session = { data: unknown; isPending: boolean };

let session: Session = { data: null, isPending: false };
const fetchMock = mock(
  async (_url: string, _init: RequestInit) => new Response("down", { status: 503 }),
);
const originalFetch = globalThis.fetch;
let consoleError: ReturnType<typeof spyOn>;

mockReactNative();
mockMobileAuth({ useSession: () => session });

const { queryClient } = await import("../../../../../../apps/mobile/src/lib/query/client");
const { useSessionGate } =
  await import("../../../../../../apps/mobile/src/modules/auth/hooks/use-session-gate");
const { adoptSessionUser, clearUserData, isSessionOwner } =
  await import("../../../../../../apps/mobile/src/modules/auth/lib/user-data");
const { saveRecentArticle, useRecentArticles } =
  await import("../../../../../../apps/mobile/src/modules/recents/lib/store");
const { readReaderPosition, writeReaderPosition } =
  await import("../../../../../../apps/mobile/src/modules/reader/lib/position");
const { readingProgressSync } =
  await import("../../../../../../apps/mobile/src/modules/reader/lib/progress-store");

const stores = {
  queryClient,
  readingProgressSync,
  saveRecentArticle,
  useRecentArticles,
  writeReaderPosition,
};
const localStorage = createMemoryLocalStorage();
let restoreWindow: () => void;
let page: ReturnType<typeof createDomPage> | undefined;

const signedIn = (userId: string | null, isPending = false): Session => ({
  data: { session: { id: `session-${userId}` }, user: userId === null ? null : { id: userId } },
  isPending,
});

type Gate = { isAuthenticated: boolean; isPending: boolean };
/** Every render of the probe, in order, so a test can read what a render returned before any effect ran. */
const renders: Gate[] = [];

function Probe() {
  const gate = useSessionGate();
  renders.push({ isAuthenticated: gate.isAuthenticated, isPending: gate.isPending });
  return createElement("div", {
    "data-authenticated": String(gate.isAuthenticated),
    "data-pending": String(gate.isPending),
  });
}

/** What the first render returns, before any effect has run. */
function firstRender(): { isAuthenticated: boolean; isPending: boolean } {
  const html = renderToStaticMarkup(createElement(Probe));
  return {
    isAuthenticated: html.includes('data-authenticated="true"'),
    isPending: html.includes('data-pending="true"'),
  };
}

async function settle() {
  page = createDomPage({ localStorage });
  const root = await page.mount(createElement(Probe));
  const probe = root.firstElementChild as HTMLElement;
  return {
    isAuthenticated: probe.dataset.authenticated === "true",
    isPending: probe.dataset.pending === "true",
  };
}

beforeAll(() => {
  restoreWindow = installWindowStorage(localStorage);
});

afterAll(() => {
  restoreWindow();
  globalThis.fetch = originalFetch;
});

beforeEach(() => {
  // The stubbed API failing is expected; the client logs each failure.
  consoleError = spyOn(console, "error").mockImplementation(() => {});
  localStorage.clear();
  queryClient.clear();
  clearUserData();
  fetchMock.mockImplementation(async () => new Response("down", { status: 503 }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  session = { data: null, isPending: false };
  renders.length = 0;
});

afterEach(async () => {
  consoleError.mockRestore();
  await page?.cleanup();
  page = undefined;
});

describe("useSessionGate", () => {
  test("holds a different account back until the previous account's data is gone", async () => {
    adoptSessionUser("user-a");
    await seedAccount(stores, localStorage, "a1");
    session = signedIn("user-b");

    // The first render must not let signed-in screens read the cache.
    expect(firstRender()).toEqual({ isAuthenticated: false, isPending: true });
    expect(readRecentIds(stores)).toEqual(["a1"]);

    expect(await settle()).toEqual({ isAuthenticated: true, isPending: false });
    expect(readRecentIds(stores)).toEqual([]);
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(readReaderPosition("a1")).toBeUndefined();
    expect(await readingProgressSync.retryBuffered()).toBe(0);
  });

  test("holds back a session whose owner is unknown, such as data from an older app version", async () => {
    await seedAccount(stores, localStorage, "legacy");
    session = signedIn("user-b");

    expect(firstRender()).toEqual({ isAuthenticated: false, isPending: true });
    expect(await settle()).toEqual({ isAuthenticated: true, isPending: false });
    expect(readRecentIds(stores)).toEqual([]);
  });

  test("lets the account that owns the data straight in and keeps its data", async () => {
    adoptSessionUser("user-a");
    await seedAccount(stores, localStorage, "a1");
    session = signedIn("user-a");

    expect(firstRender()).toEqual({ isAuthenticated: true, isPending: false });
    expect(await settle()).toEqual({ isAuthenticated: true, isPending: false });
    expect(readRecentIds(stores)).toEqual(["a1"]);
    expect(readReaderPosition("a1")).toBe(7);
  });

  test("a missing session is signed out and leaves the data alone, because it may be a network error", async () => {
    adoptSessionUser("user-a");
    await seedAccount(stores, localStorage, "a1");
    session = { data: null, isPending: false };

    expect(firstRender()).toEqual({ isAuthenticated: false, isPending: false });
    expect(await settle()).toEqual({ isAuthenticated: false, isPending: false });
    expect(readRecentIds(stores)).toEqual(["a1"]);
    expect(readReaderPosition("a1")).toBe(7);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
  });

  test.each([
    ["a session without a user", { data: { session: { id: "s" }, user: null }, isPending: false }],
    ["a user without an id", { data: { session: { id: "s" }, user: {} }, isPending: false }],
    [
      "a user with an empty id",
      { data: { session: { id: "s" }, user: { id: "" } }, isPending: false },
    ],
    ["a user without a session", { data: { user: { id: "user-b" } }, isPending: false }],
  ])("treats %s as signed out", async (_name, value) => {
    adoptSessionUser("user-a");
    await seedAccount(stores, localStorage, "a1");
    session = value;

    expect(await settle()).toEqual({ isAuthenticated: false, isPending: false });
    expect(readRecentIds(stores)).toEqual(["a1"]);
  });

  test("a sign-out followed by the same account's sign-in waits for the owner record before it mounts signed-in screens", async () => {
    adoptSessionUser("user-a");
    await seedAccount(stores, localStorage, "a1");
    session = signedIn("user-a");
    page = createDomPage({ localStorage });
    await page.mount(createElement(Probe));
    expect(renders.at(-1)).toEqual({ isAuthenticated: true, isPending: false });

    // The user logs out: the session goes first, then the account's data and owner record.
    session = { data: null, isPending: false };
    await page.render(createElement(Probe));
    clearUserData();
    expect(renders.at(-1)).toEqual({ isAuthenticated: false, isPending: false });

    // Signing back in as the same account: no signed-in screen may render before the owner is set,
    // or its queries start and the adoption then wipes the cache under them.
    session = signedIn("user-a");
    renders.length = 0;
    await page.render(createElement(Probe));

    expect(renders[0]).toEqual({ isAuthenticated: false, isPending: true });
    expect(renders.at(-1)).toEqual({ isAuthenticated: true, isPending: false });
    expect(isSessionOwner("user-a")).toBe(true);
    expect(readRecentIds(stores)).toEqual([]);
  });

  test("a session that goes missing and returns without a sign-out keeps the account signed in and its data", async () => {
    adoptSessionUser("user-a");
    await seedAccount(stores, localStorage, "a1");
    session = signedIn("user-a");
    page = createDomPage({ localStorage });
    await page.mount(createElement(Probe));

    session = { data: null, isPending: false };
    await page.render(createElement(Probe));
    session = signedIn("user-a");
    renders.length = 0;
    await page.render(createElement(Probe));

    expect(renders.every((gate) => gate.isAuthenticated && !gate.isPending)).toBe(true);
    expect(readRecentIds(stores)).toEqual(["a1"]);
    expect(readReaderPosition("a1")).toBe(7);
  });

  test("stays pending while the auth client resolves the session", () => {
    session = { data: null, isPending: true };

    expect(firstRender()).toEqual({ isAuthenticated: false, isPending: true });
  });
});
