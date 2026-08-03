import { describe, expect, test } from "bun:test";
import { buildListenOptions } from "@app/http/listen";

describe("buildListenOptions", () => {
  test("forwards port and maxRequestBodySize", () => {
    expect(buildListenOptions({ port: 8000, maxRequestBodySize: 41_943_040 })).toEqual({
      port: 8000,
      maxRequestBodySize: 41_943_040,
    });
  });
});
