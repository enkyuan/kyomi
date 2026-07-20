import { describe, expect, test } from "vitest";
import { isRedirect } from "@tanstack/react-router";
import { requireAuth, requireGuest } from "src/routes/-guards";

const authenticated = {
  status: "authenticated" as const,
  session: { session: {} as never, user: {} as never },
};
const anonymous = { status: "anonymous" as const, session: null };

function captureRedirect(callback: () => void) {
  try {
    callback();
  } catch (error) {
    expect(isRedirect(error)).toBe(true);
    return error as { options: Record<string, unknown> };
  }
  throw new Error("Expected route guard to redirect");
}

describe("auth route guards", () => {
  test("allows authenticated users into protected routes", () => {
    expect(() => requireAuth(authenticated, "/inbox/article?filter=saved")).not.toThrow();
  });

  test("redirects anonymous users to login with their protected destination", () => {
    const error = captureRedirect(() =>
      requireAuth(anonymous, "/inbox/article?filter=saved#reader"),
    );

    expect(error.options).toMatchObject({
      href: "/?redirect=%2Finbox%2Farticle%3Ffilter%3Dsaved%23reader",
      replace: true,
    });
  });

  test("does not preserve an unsafe protected destination", () => {
    const error = captureRedirect(() => requireAuth(anonymous, "https://evil.example/inbox"));

    expect(error.options).toMatchObject({
      href: "/",
    });
  });

  test("redirects authenticated guests to a validated destination", () => {
    const error = captureRedirect(() => requireGuest(authenticated, "/inbox/article?filter=saved"));

    expect(error.options).toMatchObject({
      href: "/inbox/article?filter=saved",
      replace: true,
    });
  });

  test("falls back to inbox when a guest redirect target is unsafe", () => {
    const error = captureRedirect(() => requireGuest(authenticated, "https://evil.example"));

    expect(error.options).toMatchObject({ href: "/inbox", replace: true });
  });
});
