// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { SHELL_INIT_SCRIPT } from "@/app/shell-init";

function runShellInit() {
  new Function(SHELL_INIT_SCRIPT)();
}

function clearCookies() {
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (name) {
      document.cookie = `${name}=; max-age=0; path=/`;
    }
  }
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-sidebar-state");
  document.documentElement.removeAttribute("data-inbox-article-open-behavior");
  clearCookies();
});

afterEach(clearCookies);

describe("pre-hydration shell script", () => {
  test("applies the sidebar and article-open cookies", () => {
    document.cookie = "sidebar_state=false; path=/";
    document.cookie = "cronos_inbox_article_open_behavior=reader; path=/";

    runShellInit();

    expect(document.documentElement.dataset.sidebarState).toBe("collapsed");
    expect(document.documentElement.dataset.inboxArticleOpenBehavior).toBe("reader");
  });

  test("still applies them when another cookie has malformed percent-encoding", () => {
    document.cookie = "tossed=%E0%A4%A; path=/";
    document.cookie = "sidebar_state=true; path=/";
    document.cookie = "cronos_inbox_article_open_behavior=%E0%A4%A; path=/";

    runShellInit();

    expect(document.documentElement.dataset.sidebarState).toBe("expanded");
    expect(document.documentElement.dataset.inboxArticleOpenBehavior).toBeUndefined();
  });
});
