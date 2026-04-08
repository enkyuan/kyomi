import { describe, expect, test } from "bun:test";
import { fieldsForJob, parseJob, toRedisStreamFieldList } from "./index";

describe("job-queue", () => {
  test("round-trips a feed refresh job through flat fields", () => {
    const job = {
      type: "feed.refresh" as const,
      payload: {
        feedId: "feed_1",
        userId: "user_1",
      },
    };

    const fields = fieldsForJob(job);
    expect(toRedisStreamFieldList(fields)).toEqual([
      "type",
      "feed.refresh",
      "payload",
      JSON.stringify(job.payload),
    ]);
    expect(parseJob(fields)).toEqual(job);
  });

  test("rejects unknown job types", () => {
    expect(() => parseJob({ type: "nope", payload: "{}" })).toThrow("Unsupported job type");
  });
});
