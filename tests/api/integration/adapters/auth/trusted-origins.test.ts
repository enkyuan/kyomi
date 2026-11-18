import { describe, expect, test } from "bun:test";
import { resolveBetterAuthTrustedOrigins } from "@kyomi/db";

const baseURL = "https://api.kyomi.example";
const additionalOrigins = ["https://app.kyomi.example"];

describe("trusted origins", () => {
  test("production trusts the API and the web app, and nothing on localhost", () => {
    expect(
      resolveBetterAuthTrustedOrigins({ baseURL, additionalOrigins, includeLocalhost: false }),
    ).toEqual([baseURL, "https://app.kyomi.example"]);
  });

  test("development also trusts the local web server", () => {
    const origins = resolveBetterAuthTrustedOrigins({ baseURL, additionalOrigins });

    expect(origins).toContain("http://localhost:3000");
    expect(origins).toContain("https://app.kyomi.example");
  });

  test("an explicit list is used as written, in every environment", () => {
    for (const includeLocalhost of [true, false]) {
      expect(
        resolveBetterAuthTrustedOrigins({
          baseURL,
          additionalOrigins,
          includeLocalhost,
          trustedOrigins: " https://a.example , https://b.example ,",
        }),
      ).toEqual(["https://a.example", "https://b.example"]);
    }
  });
});
