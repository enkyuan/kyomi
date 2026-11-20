// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "../../../../../../../apps/web/node_modules/@tanstack/react-query";
import { expect, test, vi } from "vitest";
import { useTranslation } from "@modules/reader/hooks/use-translation";

const { requestTranslation, getTranslation } = vi.hoisted(() => ({
  requestTranslation: vi.fn(),
  getTranslation: vi.fn(),
}));
vi.mock("@modules/reader/lib/api", () => ({ requestTranslation, getTranslation }));
vi.mock("@integrations/better-auth/provider", () => ({
  useAuth: () => ({ user: { id: "reader" } }),
}));

test("the header translates on demand and the separately mounted reader can restore the original", async () => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const useReader = () => useTranslation("article", "original", "fr-CA", null);
  const header = renderHook(useReader, { wrapper });
  const body = renderHook(useReader, { wrapper });
  requestTranslation.mockResolvedValue({ id: "translation", status: "queued" });
  getTranslation.mockResolvedValue({
    id: "translation",
    status: "ready",
    translated_content: "Texte français",
    target_language: "fr",
  });
  expect(requestTranslation).not.toHaveBeenCalled();
  await act(async () => {
    await header.result.current.toggle();
  });
  await waitFor(() =>
    expect(body.result.current.result?.translated_content).toBe("Texte français"),
  );
  expect(getTranslation).toHaveBeenCalledTimes(1);
  expect(requestTranslation).toHaveBeenCalledTimes(1);
  expect(header.result.current.label).toBe("Show original article");
  await act(async () => {
    await body.result.current.toggle();
  });
  await waitFor(() => expect(header.result.current.result).toBeNull());
  client.clear();
});
