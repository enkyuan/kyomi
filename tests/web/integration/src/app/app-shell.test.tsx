import { render } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AppShell } from "@/app/app-shell";

// AppSidebar does data fetching, lazy dialogs, and router-aware links — none of that is relevant
// to the shell's own width behavior, so it's stubbed out here.
vi.mock("@modules/sidebar/components/app-sidebar", () => ({
  AppSidebar: () => <div data-testid="app-sidebar-stub" />,
}));

beforeEach(() => {
  // SidebarProvider's useSidebar() calls useMediaQuery("max-md"), which calls
  // window.matchMedia — jsdom doesn't implement it, so it must be stubbed for any render that
  // goes through SidebarProvider (see modules/settings/components/appearance/index.test.tsx for
  // the same pattern).
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("AppShell", () => {
  test("caps content width with a graduated ladder instead of a single static max-width", () => {
    const { container } = render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );

    const shellContent = container.querySelector('[data-slot="app-shell-content"]');
    expect(shellContent).not.toBeNull();

    // JSDOM never evaluates CSS media queries against a simulated viewport, so this can only
    // assert the class tokens are present, not the rendered width at a given breakpoint — that's
    // confirmed manually in a real browser instead (see the plan's Task 6).
    const className = shellContent?.className ?? "";
    expect(className).toContain("max-w-none");
    expect(className).toContain("xl:max-w-[84rem]");
    expect(className).toContain("2xl:max-w-[90rem]");
    expect(className).toContain("3xl:max-w-[100rem]");
    expect(className).toContain("4xl:max-w-[112rem]");

    // The old static cap must not come back as an inline style.
    expect((shellContent as HTMLElement | null)?.style.maxWidth).toBe("");
  });
});
