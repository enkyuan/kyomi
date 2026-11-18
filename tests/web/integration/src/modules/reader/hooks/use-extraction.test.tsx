// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "../../../../../../../apps/web/node_modules/@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ArticleDetailDto } from "@kyomi/reader/schemas";
import { useReaderExtract } from "@modules/reader/hooks/use-extraction";

const { extractInboxItemFullText, promise } = vi.hoisted(() => ({
  extractInboxItemFullText: vi.fn(),
  promise: vi.fn((work: Promise<unknown>) => work),
}));

vi.mock("@modules/articles/lib/api", () => ({ extractInboxItemFullText }));
vi.mock("@kyomi/ui/components/toast", () => ({ toastManager: { promise } }));

function item(status: "pending" | "failed" = "pending"): ArticleDetailDto {
  return {
    id: "article-1",
    link: "https://example.com/post",
    reader: { extracted: { status, content: null, error: null, available: false } },
  } as unknown as ArticleDetailDto;
}

let queryClient: QueryClient;
let consoleError: ReturnType<typeof vi.spyOn>;

function renderExtract(overrides: Partial<Parameters<typeof useReaderExtract>[0]> = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook((props: Parameters<typeof useReaderExtract>[0]) => useReaderExtract(props), {
    initialProps: {
      autoExtract: true,
      canRequestExtraction: true,
      isViewingExtracted: false,
      item: item(),
      ...overrides,
    },
    wrapper,
  });
}

/** Lets the mutation, its notifications and any effect they trigger run to rest. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  extractInboxItemFullText.mockReset();
  promise.mockClear();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
  queryClient.clear();
});

describe("automatic full-text extraction", () => {
  test("asks once, and stays quiet when the request is rejected", async () => {
    extractInboxItemFullText.mockRejectedValue(new Error("Too many requests (429)"));
    const { rerender } = renderExtract();

    await settle();
    rerender({
      autoExtract: true,
      canRequestExtraction: true,
      isViewingExtracted: false,
      item: item(),
    });
    await settle();

    expect(extractInboxItemFullText).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  test("leaves a retry to the user: the manual path asks again, with a toast", async () => {
    extractInboxItemFullText.mockRejectedValue(new Error("Too many requests (429)"));
    const { result } = renderExtract();
    await settle();
    expect(extractInboxItemFullText).toHaveBeenCalledTimes(1);

    extractInboxItemFullText.mockResolvedValue({
      ok: true,
      status: "ready",
      article: item("pending"),
    });
    await act(async () => {
      result.current.onRetryExtraction();
    });
    await settle();

    expect(extractInboxItemFullText).toHaveBeenCalledTimes(2);
    expect(promise).toHaveBeenCalledTimes(1);
  });

  test("asks again for another article, since each article gets its own request", async () => {
    extractInboxItemFullText.mockRejectedValue(new Error("Too many requests (429)"));
    const { rerender } = renderExtract();
    await settle();

    rerender({
      autoExtract: true,
      canRequestExtraction: true,
      isViewingExtracted: false,
      item: { ...item(), id: "article-2" } as ArticleDetailDto,
    });
    await settle();

    expect(extractInboxItemFullText).toHaveBeenCalledTimes(2);
  });

  test("does not ask when auto-extraction is off, as in a second toolbar beside the article", async () => {
    extractInboxItemFullText.mockResolvedValue({ ok: true, status: "ready", article: item() });
    renderExtract({ autoExtract: false });

    await settle();

    expect(extractInboxItemFullText).not.toHaveBeenCalled();
  });
});
