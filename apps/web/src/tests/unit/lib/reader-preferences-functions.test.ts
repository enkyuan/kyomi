import { describe, expect, test, vi } from "vitest";

describe("reader-preferences server functions", () => {
  test("uses POST server function wrapper for updates", async () => {
    const createServerFnCalls: Array<{ method: string }> = [];

    vi.doMock("@tanstack/react-start", () => ({
      createServerFn: (config: { method: string }) => {
        createServerFnCalls.push(config);
        return {
          inputValidator() {
            return this;
          },
          handler(handlerFn: unknown) {
            return handlerFn;
          },
        };
      },
    }));

    vi.doMock("@tanstack/react-start/server", () => ({
      getRequestHeaders: () => new Headers(),
    }));

    vi.doMock("@lib/api", () => ({
      apiJson: vi.fn(),
      buildForwardHeaders: () => new Headers(),
    }));

    vi.doMock("@lib/api-schemas", () => ({
      apiJsonValidated: (_schema: unknown, exec: () => unknown) => exec(),
      readerPreferencesSchema: {},
    }));

    await import("@modules/reader/reader-preferences");

    expect(createServerFnCalls[0]).toEqual({ method: "GET" });
    expect(createServerFnCalls[1]).toEqual({ method: "POST" });
  });
});
