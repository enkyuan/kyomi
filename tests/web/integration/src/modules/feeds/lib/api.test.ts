// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  followFeed,
  getOpmlImportStatus,
  unfollowFeed,
  updateFeedSubscription,
} from "@modules/feeds/lib/api";
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

const FEED = "0e6a2c7e-52f4-4a43-8d0f-5f1f7a4d2b90";
const API = "http://api.internal:8000";

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

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [URL, RequestInit];
  return { url: url.href, method: init.method ?? "GET", body: init.body as string | undefined };
}

// The same attacks, minus the ones that stand for an empty feed id, or that trim to a safe one: a
// feed or task id is trimmed before it is checked.
const FEED_ID_ATTACKS = (PATH_ATTACKS as unknown[]).filter(
  (value) => typeof value === "string" && !/^[\w-]*$/.test(value.trim()),
);

describe.each([
  {
    name: "unfollowFeed",
    call: (feedId: unknown) => unfollowFeed({ data: { feedId } as never }),
    expected: { path: `/api/v1/feeds/${FEED}`, method: "DELETE" },
  },
  {
    name: "updateFeedSubscription",
    call: (feedId: unknown) =>
      updateFeedSubscription({ data: { feedId, customTitle: "Mine" } as never }),
    expected: { path: `/api/v1/feeds/${FEED}`, method: "PUT" },
  },
  {
    name: "followFeed",
    call: (feedId: unknown) =>
      followFeed({ data: { feedId, url: "https://example.com/feed.xml" } as never }),
    expected: { path: `/api/v1/feeds/${FEED}/subscribe`, method: "POST" },
  },
])("$name", ({ call, expected }) => {
  test.each(FEED_ID_ATTACKS)("never sends a request for the feed id %j", async (feedId) => {
    await expect(call(feedId)).rejects.toMatchObject({ status: 400 });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("acts on the feed under its own path", async () => {
    await call(FEED).catch(() => undefined);

    expect(lastRequest()).toMatchObject({ url: `${API}${expected.path}`, method: expected.method });
  });
});

describe("followFeed", () => {
  test.each([[""], ["   "], [null], [undefined]])(
    "follows a feed by its URL when the feed id is %j",
    async (feedId) => {
      await followFeed({ data: { feedId, url: "https://example.com/feed.xml" } as never }).catch(
        () => undefined,
      );

      expect(lastRequest()).toMatchObject({
        url: `${API}/api/v1/feeds`,
        method: "POST",
        body: JSON.stringify({ url: "https://example.com/feed.xml" }),
      });
    },
  );
});

describe("getOpmlImportStatus", () => {
  test.each(FEED_ID_ATTACKS)("never sends a request for the task id %j", async (taskId) => {
    await expect(getOpmlImportStatus({ data: { taskId } as never })).rejects.toMatchObject({
      status: 400,
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("asks for the import's own status", async () => {
    await getOpmlImportStatus({ data: { taskId: ` ${FEED} ` } as never }).catch(() => undefined);

    expect(lastRequest()).toMatchObject({
      url: `${API}/api/v1/opml/imports/${FEED}/status`,
      method: "GET",
    });
  });
});
