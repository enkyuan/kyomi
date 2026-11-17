// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { CreateFolderDialog } from "@modules/folders/components/create-dialog";

vi.mock("@modules/folders/lib/api", () => ({
  createFolder: vi.fn(),
}));

function renderDialog(open: boolean) {
  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <CreateFolderDialog open={open} />
    </QueryClientProvider>,
  );
}

describe("CreateFolderDialog", () => {
  test("renders its footer actions as pills, including the render-prop Cancel button", () => {
    renderDialog(true);

    for (const name of ["Cancel", "Create folder", "Close"]) {
      const button = screen.getByRole("button", { name });
      expect(button.classList.contains("rounded-full")).toBe(true);
      expect(button.classList.contains("before:rounded-full")).toBe(true);
      expect(button.classList.contains("rounded-lg")).toBe(false);
    }
  });

  test("renders the trigger as a circular icon button", () => {
    renderDialog(false);

    const trigger = screen.getByRole("button", { name: "Create folder" });

    expect(trigger.classList.contains("rounded-full")).toBe(true);
    expect(trigger.classList.contains("before:rounded-full")).toBe(true);
    expect(trigger.classList.contains("rounded-md")).toBe(false);
    expect(trigger.classList.contains("size-7")).toBe(true);
  });
});
