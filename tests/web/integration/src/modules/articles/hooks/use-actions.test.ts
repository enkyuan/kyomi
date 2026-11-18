// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useActions } from "@modules/articles/hooks/use-actions";
import type { ArticleActionItem } from "@modules/articles/lib/types";

const { toastAdd, anchoredToastAdd } = vi.hoisted(() => ({
  toastAdd: vi.fn(),
  anchoredToastAdd: vi.fn(),
}));

vi.mock("@kyomi/ui/components/toast", () => ({
  toastManager: { add: toastAdd },
  anchoredToastManager: { add: anchoredToastAdd },
}));
vi.mock("@modules/articles/hooks/use-item-state", () => ({
  useInboxItemStateMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}));

const SAFE_LINK = "https://example.com/post";

function actionsFor(link: string) {
  const item = {
    id: "9b0f2f26-6d1e-4c36-9d56-0a1c3a8b7e11",
    title: "A post",
    summary: null,
    feedTitle: "A feed",
    link,
    isSaved: false,
  } as ArticleActionItem;
  return renderHook(() => useActions({ item, saveErrorScope: "test" })).result.current;
}

let windowOpen: ReturnType<typeof vi.spyOn>;
let writeText: ReturnType<typeof vi.fn>;
let share: ReturnType<typeof vi.fn>;

beforeEach(() => {
  windowOpen = vi.spyOn(window, "open").mockReturnValue(null);
  writeText = vi.fn().mockResolvedValue(undefined);
  share = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText }, share, canShare: () => true });
});

afterEach(() => {
  vi.restoreAllMocks();
  toastAdd.mockClear();
});

// A feed controls `link`; each of these runs in this origin, or reads as a link while not being one.
const HOSTILE_LINKS = [
  "javascript:fetch('/api/v1/users/profile/email',{method:'POST'})",
  "JaVaScRiPt:alert(1)",
  " \tjavascript:alert(1)",
  "java\nscript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
  "blob:https://example.com/1",
  "file:///etc/passwd",
  "//evil.example/x",
  "",
];

describe("useActions link handling", () => {
  test.each(HOSTILE_LINKS)("never opens %j", (link) => {
    const actions = actionsFor(link);

    actions.openSource({ newTab: false });
    actions.openSource({ newTab: true });
    actions.openSource();

    expect(windowOpen).not.toHaveBeenCalled();
  });

  test("opens an http(s) link in a new tab without an opener", () => {
    actionsFor(SAFE_LINK).openSource();

    expect(windowOpen).toHaveBeenCalledExactlyOnceWith(SAFE_LINK, "_blank", "noopener,noreferrer");
  });

  test("opens an http(s) link in the same tab on request", () => {
    actionsFor("http://example.com/post?a=1").openSource({ newTab: false });

    expect(windowOpen).toHaveBeenCalledExactlyOnceWith(
      "http://example.com/post?a=1",
      "_self",
      undefined,
    );
  });

  test("opens the parsed address, so spacing around a link cannot change its scheme", () => {
    actionsFor("  https://example.com/post  ").openSource();

    expect(windowOpen).toHaveBeenCalledWith(SAFE_LINK, "_blank", "noopener,noreferrer");
  });

  test.each(HOSTILE_LINKS)("never copies %j, and says the copy failed", async (link) => {
    actionsFor(link).copyLink();
    await vi.waitFor(() => expect(toastAdd).toHaveBeenCalled());

    expect(writeText).not.toHaveBeenCalled();
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Unable to copy link" }),
    );
  });

  test("copies an http(s) link", async () => {
    actionsFor(SAFE_LINK).copyLink();
    await vi.waitFor(() => expect(toastAdd).toHaveBeenCalled());

    expect(writeText).toHaveBeenCalledExactlyOnceWith(SAFE_LINK);
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: "Link copied" }));
  });

  test.each(HOSTILE_LINKS)("never shares %j, and reports the failure", async (link) => {
    actionsFor(link).shareArticle();
    await vi.waitFor(() => expect(toastAdd).toHaveBeenCalled());

    expect(share).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Unable to share article" }),
    );
  });

  test("shares an http(s) link", async () => {
    actionsFor(SAFE_LINK).shareArticle();
    await vi.waitFor(() => expect(share).toHaveBeenCalled());

    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: SAFE_LINK }));
  });
});
