// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { EmailDialog } from "@modules/settings/components/account/email-dialog";

describe("EmailDialog", () => {
  test("keeps its footer actions rectangular, including the render-prop Cancel button", () => {
    render(
      <EmailDialog
        draft="reader@example.com"
        error={null}
        isSaving={false}
        onDraftChange={vi.fn()}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        open
      />,
    );

    for (const name of ["Cancel", "Save email"]) {
      const button = screen.getByRole("button", { name });
      expect(button.classList.contains("rounded-lg")).toBe(true);
      expect(button.classList.contains("rounded-full")).toBe(false);
    }
  });
});
