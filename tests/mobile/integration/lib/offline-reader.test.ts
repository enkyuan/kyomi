import { afterAll, expect, test } from "bun:test";
import {
  editFlags,
  editProgress,
  pagePosition,
  pages,
  replay,
  snapshot,
} from "@kyomi/reader/offline";
import type { ArticleDetailDto, ReadingProgressUpdateBody } from "@kyomi/reader/schemas/article";
import { createMemoryLocalStorage, installWindowStorage } from "./memory-local-storage";
import { mockMobileAuth, mockReactNative } from "./module-mocks";
import { mockOfflineSqlite } from "./offline-sqlite";

mockMobileAuth();
mockReactNative();
mockOfflineSqlite();
const restore = installWindowStorage(createMemoryLocalStorage());
afterAll(restore);
const { library } = await import("../../../../apps/mobile/src/lib/offline/library");
const { adoptSessionUser, clearUserData } =
  await import("../../../../apps/mobile/src/modules/auth/lib/user-data");
const article = {
  id: "a",
  title: "Offline article",
  reader: {
    selected: {
      bodyKind: "html",
      contentSource: "feed_html",
      contentHtml: "<p>One &amp; two</p><p>" + "reading ".repeat(800) + "</p><img src='/origin'>",
    },
  },
} as ArticleDetailDto;
const update: ReadingProgressUpdateBody = {
  progress: 0.5,
  anchor: null,
  sessionId: "6c4c508a-546a-4af2-ae53-7fb41d0eca3f",
  sessionActiveMs: 2000,
  clientUpdatedAt: new Date().toISOString(),
  completed: false,
  contentKey: "feed_html:none",
};

test("durably saves a list item, resumes a download and preserves a newer edit during replay", async () => {
  adoptSessionUser("first");
  await editFlags(library, "first", "a", { isSaved: true });
  const calls: unknown[] = [];
  const transport = {
    put: async (_id: string, _path: string, body: unknown) => {
      calls.push(body);
    },
    detail: async () => article,
  };
  await expect(
    replay(library, "first", {
      ...transport,
      detail: async () => {
        throw Error("offline");
      },
    }),
  ).rejects.toThrow();
  expect(await library.list("first", true)).toHaveLength(1);
  await replay(library, "first", transport);
  const [saved] = await library.list("first");
  expect(saved.document?.text).toStartWith("One & two\n");
  expect(saved.document?.text).not.toContain("/origin");
  expect(pages(saved.document!.text).join("")).toBe(saved.document!.text);
  expect((await library.list("first", true)).length).toBe(0);
  await editProgress(library, "first", "a", update);
  await replay(library, "first", {
    ...transport,
    put: async () => {
      await editFlags(library, "first", "a", { isRead: true });
    },
  });
  expect((await library.list("first", true))[0].position).toBe(0.5);
  await replay(library, "first", transport);
  expect((await library.list("first"))[0].read).toBe(true);
  expect(await library.list("first", true)).toEqual([]);
  await editFlags(library, "first", "a", { isSaved: false });
  await replay(library, "first", transport);
  expect(await library.list("first")).toEqual([]);
});

test("blocks previous-account reads, late downloads and signed-out writes", async () => {
  adoptSessionUser("old");
  await editFlags(library, "old", "a", { isSaved: true });
  await expect(
    replay(library, "old", {
      put: async () => {},
      detail: async () => {
        adoptSessionUser("new");
        return article;
      },
    }),
  ).rejects.toThrow();
  expect(await library.list("old")).toEqual([]);
  expect(await library.list("new")).toEqual([]);
  await editFlags(library, "new", "a", { isSaved: true }, article);
  clearUserData();
  await expect(editProgress(library, "new", "a", update)).rejects.toThrow();
  expect(await library.list("new")).toEqual([]);
  expect(pagePosition(0, 1)).toBe(0);
  expect(snapshot(article).contentKey).toBe(update.contentKey);
});
