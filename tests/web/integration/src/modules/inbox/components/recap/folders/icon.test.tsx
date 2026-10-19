// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { FolderIconBadge } from "@modules/inbox/components/recap/folders/icon";

describe("FolderIconBadge", () => {
  test("clips to a squircle built for its rendered 36px box", () => {
    const { container } = render(<FolderIconBadge />);
    const badge = container.querySelector<HTMLElement>("[data-squircle]");
    const path = badge?.style.clipPath ?? "";
    const coordinates = (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

    expect(badge?.className).toContain("size-9");
    expect(coordinates.length).toBeGreaterThan(0);
    expect(Math.max(...coordinates)).toBeCloseTo(36, 0);
  });
});
