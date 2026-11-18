// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  dismissContinueReading,
  extractInboxItemFullText,
  getInboxItemDetail,
  recordInboxItemView,
  reportBrokenArticle,
  saveReadingProgress,
  updateInboxItemState,
} from "@modules/articles/lib/api";
import { getInboxItemIdFromSlug } from "@modules/articles/lib/slug";
import { validateInboxSearch } from "@modules/inbox/lib/search";
import { PATH_ATTACKS } from "../../../lib/path-attacks";

// Mocks resolve from this file, which cannot see the web app's packages; point at them directly.
vi.mock(
  "../../../../../../../apps/web/node_modules/@tanstack/react-start",
  async () => await import("../../../lib/server-fn"),
);
vi.mock(
  "../../../../../../../apps/web/node_modules/@tanstack/react-start/dist/esm/server.js",
  async () => await import("../../../lib/server-fn"),
);

const UUID = "9b0f2f26-6d1e-4c36-9d56-0a1c3a8b7e11";
const API = "http://api.internal:8000";

type ItemFunction = {
  name: string;
  call: (input: { data: never }) => Promise<unknown>;
  input: (itemId: string) => unknown;
  method: string;
  suffix: string;
};

// Every server function in the module whose request path carries the item id.
const ITEM_FUNCTIONS: ItemFunction[] = [
  {
    name: "getInboxItemDetail",
    call: getInboxItemDetail,
    method: "GET",
    suffix: "",
    input: (itemId) => ({ itemId }),
  },
  {
    name: "updateInboxItemState",
    call: updateInboxItemState,
    method: "PUT",
    suffix: "",
    input: (itemId) => ({ itemId, isRead: true }),
  },
  {
    name: "reportBrokenArticle",
    call: reportBrokenArticle,
    method: "POST",
    suffix: "/reports/broken",
    input: (itemId) => ({ itemId }),
  },
  {
    name: "recordInboxItemView",
    call: recordInboxItemView,
    method: "POST",
    suffix: "/view",
    input: (itemId) => ({ itemId }),
  },
  {
    name: "extractInboxItemFullText",
    call: extractInboxItemFullText,
    method: "POST",
    suffix: "/extract-full-text",
    input: (itemId) => ({ itemId }),
  },
  {
    name: "saveReadingProgress",
    call: saveReadingProgress,
    method: "PUT",
    suffix: "/progress",
    input: (itemId) => ({ itemId, body: { progress: 0.5 } }),
  },
  {
    name: "dismissContinueReading",
    call: dismissContinueReading,
    method: "POST",
    suffix: "/continue-reading/dismiss",
    input: (itemId) => ({ itemId }),
  },
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("API_ORIGIN", API);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  fetchMock = vi.fn(async () => Response.json({ message: "ok" }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe.each(ITEM_FUNCTIONS)("$name", ({ call, input, method, suffix }) => {
  test("never sends a request for an id that is not a UUID", async () => {
    for (const itemId of PATH_ATTACKS as string[]) {
      await expect(call({ data: input(itemId) as never })).rejects.toMatchObject({ status: 400 });
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("asks for the article under /api/v1/articles with the user's own session", async () => {
    await call({ data: input(UUID) as never }).catch(() => undefined);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit | undefined];
    expect(url.href).toBe(`${API}/api/v1/articles/${UUID}${suffix}`);
    expect(init?.method ?? "GET").toBe(method);
    expect(new Headers(init?.headers).get("cookie")).toBe("kyomi.session=victim");
  });
});

describe("recordInboxItemView", () => {
  test("returns the API's answer for a legitimate id", async () => {
    await expect(recordInboxItemView({ data: { itemId: UUID } as never })).resolves.toEqual({
      message: "ok",
    });
  });

  test("cannot be pointed at another API route with a traversing id", async () => {
    await expect(
      recordInboxItemView({ data: { itemId: "../auth/sign-out?" } as never }),
    ).rejects.toThrow("That id is not valid.");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("updateInboxItemState", () => {
  test("forwards only the fields the caller set", async () => {
    await updateInboxItemState({ data: { itemId: UUID, isSaved: false } as never });

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ isSaved: false });
  });
});

describe("article id in a route", () => {
  test("a slug yields its id only when that id is a UUID", () => {
    expect(getInboxItemIdFromSlug(`${UUID}--a-post`)).toBe(UUID);
    expect(getInboxItemIdFromSlug("../x--y")).toBeUndefined();
    expect(getInboxItemIdFromSlug("..%2f..%2fauth--y")).toBeUndefined();
    expect(getInboxItemIdFromSlug(`${UUID}/../x--y`)).toBeUndefined();
    expect(getInboxItemIdFromSlug("a-post")).toBeUndefined();
    expect(getInboxItemIdFromSlug(undefined)).toBeUndefined();
  });

  test("a search param yields its id only when that id is a UUID", () => {
    expect(validateInboxSearch({ itemId: UUID }).itemId).toBe(UUID);
    expect(validateInboxSearch({ itemId: "../x?" }).itemId).toBeUndefined();
    expect(validateInboxSearch({ itemId: ["../x"] }).itemId).toBeUndefined();
    expect(validateInboxSearch({ itemId: 7 }).itemId).toBeUndefined();
  });
});
