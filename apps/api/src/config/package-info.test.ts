import { describe, expect, test } from "bun:test";
import { API_PACKAGE_VERSION } from "./package-info";

describe("package-info", () => {
  test("API_PACKAGE_VERSION matches semver shape from package.json", () => {
    expect(API_PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
