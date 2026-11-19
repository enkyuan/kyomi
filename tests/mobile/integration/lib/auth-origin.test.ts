// Value: protects=a release build talks to the API only over https and never falls back to a local server, while development keeps its local defaults and overrides;
//   fails_when=a release bundle accepts an http or missing origin (the session cookie and sign-in codes would travel in clear text or to localhost), or a development bundle loses its fallback;
//   why_new=resolveAuthOrigin accepted any http:// origin and silently fell back to localhost in every build;
//   seam=the pure parser, plus the resolver reading EXPO_PUBLIC_AUTH_ORIGIN and __DEV__;
//   no_claim=green does not prove Metro inlines the variable, or what the OS does with a cleartext request.
import { afterEach, describe, expect, test } from "bun:test";
import { mockReactNative } from "./module-mocks";

mockReactNative();

const { parseAuthOrigin, resolveAuthOrigin } =
  await import("../../../../apps/mobile/src/lib/auth-origin");

const RELEASE = { dev: false, platform: "ios" } as const;
const DEV = { dev: true, platform: "ios" } as const;

describe("parseAuthOrigin in a release build", () => {
  test.each([undefined, "", "   "])(
    "refuses to start without an origin (%p), with no localhost fallback",
    (value) => {
      expect(() => parseAuthOrigin(value, RELEASE)).toThrow(/EXPO_PUBLIC_AUTH_ORIGIN must be set/);
      expect(() => parseAuthOrigin(value, { dev: false, platform: "android" })).toThrow(
        /EXPO_PUBLIC_AUTH_ORIGIN must be set/,
      );
    },
  );

  test.each([
    "http://api.example.com",
    "http://localhost:8000",
    "http://10.0.2.2:8000",
    "http://192.168.1.20:8000",
    "HTTP://api.example.com",
    "ftp://api.example.com",
    "//api.example.com",
    "api.example.com",
    "https://",
    "https:// api.example.com",
    "javascript:alert(1)",
  ])("refuses %p, which is not an https origin", (value) => {
    expect(() => parseAuthOrigin(value, RELEASE)).toThrow(/must be an https origin/);
  });

  test.each([
    ["https://api.example.com", "https://api.example.com"],
    ["https://api.example.com/", "https://api.example.com"],
    ["  https://api.example.com:8443  ", "https://api.example.com:8443"],
    ["HTTPS://api.example.com", "HTTPS://api.example.com"],
  ])("accepts the https origin %p", (value, origin) => {
    expect(parseAuthOrigin(value, RELEASE)).toBe(origin);
  });
});

describe("parseAuthOrigin in development", () => {
  test("keeps the local fallbacks per platform", () => {
    expect(parseAuthOrigin(undefined, DEV)).toBe("http://localhost:8000");
    expect(parseAuthOrigin("  ", DEV)).toBe("http://localhost:8000");
    expect(parseAuthOrigin(undefined, { dev: true, platform: "android" })).toBe(
      "http://10.0.2.2:8000",
    );
  });

  test("keeps accepting a LAN or tunnel origin over http", () => {
    expect(parseAuthOrigin("http://192.168.1.20:8000/", DEV)).toBe("http://192.168.1.20:8000");
    expect(parseAuthOrigin("https://kyomi.ngrok-free.app", DEV)).toBe(
      "https://kyomi.ngrok-free.app",
    );
  });
});

describe("resolveAuthOrigin", () => {
  const globals = globalThis as unknown as { __DEV__?: boolean };
  const originalDev = globals.__DEV__;
  const originalOrigin = process.env.EXPO_PUBLIC_AUTH_ORIGIN;

  afterEach(() => {
    globals.__DEV__ = originalDev;
    if (originalOrigin === undefined) delete process.env.EXPO_PUBLIC_AUTH_ORIGIN;
    else process.env.EXPO_PUBLIC_AUTH_ORIGIN = originalOrigin;
  });

  test("applies the release rules to the configured origin", () => {
    globals.__DEV__ = false;

    delete process.env.EXPO_PUBLIC_AUTH_ORIGIN;
    expect(() => resolveAuthOrigin()).toThrow(/must be set/);

    process.env.EXPO_PUBLIC_AUTH_ORIGIN = "http://api.example.com";
    expect(() => resolveAuthOrigin()).toThrow(/https origin/);

    process.env.EXPO_PUBLIC_AUTH_ORIGIN = "https://api.example.com/";
    expect(resolveAuthOrigin()).toBe("https://api.example.com");
  });

  test("applies the development rules in a development bundle", () => {
    globals.__DEV__ = true;

    delete process.env.EXPO_PUBLIC_AUTH_ORIGIN;
    expect(resolveAuthOrigin()).toBe("http://localhost:8000");

    process.env.EXPO_PUBLIC_AUTH_ORIGIN = "http://192.168.1.20:8000";
    expect(resolveAuthOrigin()).toBe("http://192.168.1.20:8000");
  });
});
