// Value: protects=an article-state change that fails rolls the list back to what it was, and never writes a list back that sign-out or another account has replaced since;
//   fails_when=the rollback restores the previous account's articles into a cleared cache (where the persister saves them for the next account), or overwrites another account's list, or stops undoing a failed change;
//   why_new=the optimistic update snapshotted the lists and restored them on any failure, with nothing guarding against clearUserData in between;
//   seam=the real mutation hook and real query client in jsdom, with fetch held open so the sign-out lands between the optimistic update and the failure;
//   no_claim=green does not prove the persister's write on a device or how two overlapping changes to one list settle after the refetch.
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
import { QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createDomPage } from "../../../lib/dom-page";
import { createMemoryLocalStorage, installWindowStorage } from "../../../lib/memory-local-storage";
import { mockMobileAuth, mockReactNative } from "../../../lib/module-mocks";
import { article } from "../../auth/lib/account-data";

const SUBSCRIBED = ["inbox", "articles", "subscribed"];
const EXPLORE = ["inbox", "articles", "explore"];

mockReactNative();
mockMobileAuth();

const { queryClient } = await import("../../../../../../apps/mobile/src/lib/query/client");
const { useArticleStateMutation } =
  await import("../../../../../../apps/mobile/src/modules/inbox/hooks/use-state");
const { clearUserData } =
  await import("../../../../../../apps/mobile/src/modules/auth/lib/user-data");

const localStorage = createMemoryLocalStorage();
const originalFetch = globalThis.fetch;
let restoreWindow: () => void;
let consoleError: ReturnType<typeof spyOn>;
let respond: (response: Response) => void = () => undefined;
let page: ReturnType<typeof createDomPage> | undefined;
let mutation: ReturnType<typeof useArticleStateMutation>;

const list = (id: string, overrides = {}) => ({
  pageParams: [null],
  pages: [{ items: [{ ...article(id), ...overrides }], nextCursor: null }],
});
const savedIds = (key: string[]) =>
  (
    queryClient.getQueryData(key) as { pages: { items: { id: string; isSaved: boolean }[] }[] }
  )?.pages.flatMap((entry) => entry.items.map((item) => `${item.id}:${item.isSaved}`));

function Probe() {
  mutation = useArticleStateMutation();
  return null;
}

/** Starts a save of `a1` whose request stays open; `fail()` ends it with a 401. */
async function startSave() {
  let settled: Promise<unknown> = Promise.resolve();
  await act(async () => {
    settled = mutation.mutateAsync({ itemId: "a1", patch: { isSaved: true } }).catch(() => null);
  });
  return {
    async fail() {
      await act(async () => {
        respond(new Response("{}", { status: 401 }));
        await settled;
      });
    },
  };
}

beforeAll(() => {
  restoreWindow = installWindowStorage(localStorage);
});

afterAll(() => {
  restoreWindow();
  globalThis.fetch = originalFetch;
});

beforeEach(async () => {
  consoleError = spyOn(console, "error").mockImplementation(() => {});
  localStorage.clear();
  queryClient.clear();
  globalThis.fetch = mock(
    () => new Promise<Response>((resolve) => (respond = resolve)),
  ) as unknown as typeof fetch;
  queryClient.setQueryData(SUBSCRIBED, list("a1"));
  queryClient.setQueryData(EXPLORE, list("a1"));
  page = createDomPage({ localStorage });
  await page.mount(
    createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)),
  );
});

afterEach(async () => {
  consoleError.mockRestore();
  // The query client notifies observers on a timer; let that run while the page still exists.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  await page?.cleanup();
  page = undefined;
  queryClient.clear();
});

describe("a failed article-state change", () => {
  test("puts the lists back when nothing else touched them", async () => {
    const save = await startSave();
    expect(savedIds(SUBSCRIBED)).toEqual(["a1:true"]);
    expect(savedIds(EXPLORE)).toEqual(["a1:true"]);

    await save.fail();

    expect(savedIds(SUBSCRIBED)).toEqual(["a1:false"]);
    expect(savedIds(EXPLORE)).toEqual(["a1:false"]);
  });

  test("does not write the previous account's lists back after sign-out cleared them", async () => {
    const save = await startSave();

    clearUserData();
    await save.fail();

    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(queryClient.getQueryData(SUBSCRIBED)).toBeUndefined();
    expect(queryClient.getQueryData(EXPLORE)).toBeUndefined();
  });

  test("does not overwrite the list another account loaded in the meantime", async () => {
    const save = await startSave();

    clearUserData();
    queryClient.setQueryData(SUBSCRIBED, list("b1"));
    await save.fail();

    expect(savedIds(SUBSCRIBED)).toEqual(["b1:false"]);
    expect(queryClient.getQueryData(EXPLORE)).toBeUndefined();
  });
});
