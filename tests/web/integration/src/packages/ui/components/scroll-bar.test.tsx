import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ScrollAreaPrimitive } from "@kyomi/ui/components/scroll-area";
import { ScrollBar } from "@kyomi/ui/components/scroll-bar";

function renderScrollBar(
  placement?: "container" | "viewport",
  orientation?: "vertical" | "horizontal",
) {
  return render(
    <ScrollAreaPrimitive.Root data-testid="root">
      <ScrollAreaPrimitive.Viewport>content</ScrollAreaPrimitive.Viewport>
      <ScrollBar keepMounted orientation={orientation} placement={placement} />
    </ScrollAreaPrimitive.Root>,
  );
}

describe("ScrollBar", () => {
  test("keeps the track inside its scroll area by default", () => {
    const { getByTestId } = renderScrollBar();

    const track = getByTestId("root").querySelector('[data-slot="scroll-area-scrollbar"]');
    expect(track).not.toBeNull();
  });

  test("portals a viewport-placed track to the window edge", () => {
    const { getByTestId } = renderScrollBar("viewport");

    expect(getByTestId("root").querySelector('[data-slot="scroll-area-scrollbar"]')).toBeNull();
    const track = document.body.querySelector<HTMLElement>('[data-slot="scroll-area-scrollbar"]');
    expect(track?.parentElement).toBe(document.body);
    expect(track?.style.position).toBe("fixed");
    expect(track?.style.top).toBe("0px");
    expect(track?.style.bottom).toBe("0px");
  });

  test("pins a horizontal viewport track to the bottom edge", () => {
    renderScrollBar("viewport", "horizontal");

    const track = document.body.querySelector<HTMLElement>('[data-slot="scroll-area-scrollbar"]');
    expect(track?.style.position).toBe("fixed");
    expect(track?.style.bottom).toBe("0px");
    expect(track?.style.top).toBe("");
  });

  // Value: protects=a viewport-placed ScrollBar renders nothing during server rendering instead of throwing in createPortal, and a caller style wins over the edge style;
  //   fails_when=the canPortal guard is removed (document is not defined on the server) or the edge style overrides caller style;
  //   why_new=every other test here runs after hydration, so the server branch had no test;
  //   seam=none; no_claim=hydration in a real browser.
  test("renders nothing on the server for a viewport-placed track", () => {
    const html = renderToString(
      <ScrollAreaPrimitive.Root>
        <ScrollBar keepMounted placement="viewport" />
      </ScrollAreaPrimitive.Root>,
    );

    expect(html).not.toContain("scroll-area-scrollbar");
  });

  test("lets a caller style override the viewport edge style", () => {
    render(
      <ScrollAreaPrimitive.Root>
        <ScrollBar keepMounted placement="viewport" style={{ top: 8 }} />
      </ScrollAreaPrimitive.Root>,
    );

    const track = document.body.querySelector<HTMLElement>('[data-slot="scroll-area-scrollbar"]');
    expect(track?.style.top).toBe("8px");
    expect(track?.style.position).toBe("fixed");
  });
});
