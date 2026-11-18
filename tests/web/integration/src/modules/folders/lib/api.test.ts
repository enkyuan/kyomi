// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { deleteFolder, moveFeedsToFolder, updateFolder } from "@modules/folders/lib/api";
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

const FOLDER = "9b0f2f26-6d1e-4c36-9d56-0a1c3a8b7e11";
const FEED = "0e6a2c7e-52f4-4a43-8d0f-5f1f7a4d2b90";
const API = "http://api.internal:8000";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("API_ORIGIN", API);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  fetchMock = vi.fn(async () => Response.json({ updatedCount: 1 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [URL, RequestInit];
  return { url: url.href, method: init.method, body: init.body as string | undefined };
}

describe("folder ids", () => {
  test.each(PATH_ATTACKS as string[])("are checked before any request: %j", async (folderId) => {
    await expect(updateFolder({ data: { folderId, name: "x" } as never })).rejects.toMatchObject({
      status: 400,
    });
    await expect(deleteFolder({ data: { folderId } as never })).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      moveFeedsToFolder({ data: { feedIds: [FEED], folderId } as never }),
    ).rejects.toMatchObject({ status: 400 });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a folder is renamed and deleted under its own path", async () => {
    await updateFolder({ data: { folderId: FOLDER, name: " Work " } as never });
    expect(lastRequest()).toMatchObject({
      url: `${API}/api/v1/folders/${FOLDER}`,
      method: "PUT",
      body: JSON.stringify({ name: "Work" }),
    });

    await deleteFolder({ data: { folderId: FOLDER } as never });
    expect(lastRequest()).toMatchObject({
      url: `${API}/api/v1/folders/${FOLDER}`,
      method: "DELETE",
    });
  });
});

describe("moveFeedsToFolder", () => {
  test.each([
    ["a feed id that is not a UUID", { feedIds: [FEED, "../x"], folderId: FOLDER }],
    ["feed ids that are not a list", { feedIds: FEED, folderId: FOLDER }],
    ["no feed ids", { folderId: FOLDER }],
  ])("refuses %s", async (_name, data) => {
    await expect(moveFeedsToFolder({ data: data as never })).rejects.toBeDefined();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("forwards the ids and nothing else the client sent", async () => {
    await moveFeedsToFolder({
      data: { feedIds: [FEED], folderId: FOLDER, userId: "someone-else", role: "admin" } as never,
    });

    expect(lastRequest()).toMatchObject({
      url: `${API}/api/v1/feeds/folder`,
      method: "PATCH",
      body: JSON.stringify({ feedIds: [FEED], folderId: FOLDER }),
    });
  });
});
