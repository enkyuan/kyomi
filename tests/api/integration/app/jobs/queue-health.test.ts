import { describe, expect, test } from "bun:test";
import { buildQueueHealthSnapshot } from "@app/jobs/queue-health";

describe("queue health snapshot", () => {
  test("reports refresh and OPML streams separately", async () => {
    const snapshot = await buildQueueHealthSnapshot({
      xlen: async (stream) => (stream === "jobs:feed-refresh" ? 12 : 3),
      xpending: async () => [2],
    });

    expect(snapshot.streams["jobs:feed-refresh"].length).toBe(12);
    expect(snapshot.streams["jobs:opml"].length).toBe(3);
    expect(snapshot.streams["jobs:feed-refresh"].pending).toBe(2);
  });
});
