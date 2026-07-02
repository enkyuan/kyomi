import { describe, expect, test, vi } from "vitest";

const createServerFnCalls: Array<{ method: string }> = [];

vi.mock("@tanstack/react-start", () => ({
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

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeaders: () => new Headers(),
}));

vi.mock("@lib/api", () => ({
  apiJson: vi.fn(),
  buildForwardHeaders: () => new Headers(),
}));

vi.mock("@lib/schemas", () => ({
  apiJsonValidated: (_schema: unknown, exec: () => unknown) => exec(),
  userPreferencesSchema: {},
}));

describe("preferences server functions", () => {
  test("uses POST server function wrapper for updates", async () => {
    await import("@modules/preferences/api");

    expect(createServerFnCalls[0]).toEqual({ method: "GET" });
    expect(createServerFnCalls[1]).toEqual({ method: "POST" });
  });
});
