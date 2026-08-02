import { describe, expect, test } from "bun:test";
import { fieldsForJob, parseJob } from "@kyomi/worker";

describe("worker queue job parsing", () => {
  test("round-trips opml.import jobs", () => {
    const fields = fieldsForJob({
      type: "opml.import",
      payload: {
        taskId: "task-1",
        userId: "user-1",
        xml: "<opml></opml>",
        filename: "feeds.opml",
      },
    });

    expect(parseJob(fields)).toEqual({
      type: "opml.import",
      payload: {
        taskId: "task-1",
        userId: "user-1",
        xml: "<opml></opml>",
        filename: "feeds.opml",
      },
    });
  });

  test("round-trips opml.import.feed jobs", () => {
    const fields = fieldsForJob({
      type: "opml.import.feed",
      payload: {
        taskId: "task-1",
        userId: "user-1",
        url: "https://example.com/feed.xml",
        title: "Example Feed",
        folderId: null,
      },
    });

    expect(parseJob(fields)).toEqual({
      type: "opml.import.feed",
      payload: {
        taskId: "task-1",
        userId: "user-1",
        url: "https://example.com/feed.xml",
        title: "Example Feed",
        folderId: null,
      },
    });
  });

  test("round-trips ID-only opml.import.prepare jobs", () => {
    const job = {
      type: "opml.import.prepare" as const,
      payload: { importId: "import-1" },
    };
    const fields = fieldsForJob(job);

    expect(parseJob(fields)).toEqual(job);
    expect(fields.payload).not.toContain("<opml");
  });

  test("rejects an opml.import.prepare payload without an importId", () => {
    expect(() => parseJob({ type: "opml.import.prepare", payload: JSON.stringify({}) })).toThrow();
  });
});
