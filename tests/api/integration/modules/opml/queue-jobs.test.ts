import { describe, expect, test } from "bun:test";
import { fieldsForJob, parseJob } from "@vols.rss/worker";

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
});
