import {
  FEED_REFRESH_JOBS_STREAM_KEY,
  JOBS_CONSUMER_GROUP,
  OPML_JOBS_STREAM_KEY,
} from "@kyomi/worker";

export type QueueHealthRedis = {
  xlen(stream: string): Promise<number>;
  xpending(stream: string, group: string): Promise<unknown>;
};

export type QueueHealthSnapshot = {
  streams: Record<string, { length: number; pending: number }>;
};

function pendingCountFromResult(result: unknown): number {
  if (Array.isArray(result) && typeof result[0] === "number") {
    return result[0];
  }

  return 0;
}

export async function buildQueueHealthSnapshot(
  redis: QueueHealthRedis,
): Promise<QueueHealthSnapshot> {
  const streamKeys = [FEED_REFRESH_JOBS_STREAM_KEY, OPML_JOBS_STREAM_KEY];
  const entries = await Promise.all(
    streamKeys.map(async (streamKey) => {
      const [length, pendingResult] = await Promise.all([
        redis.xlen(streamKey),
        redis.xpending(streamKey, JOBS_CONSUMER_GROUP).catch(() => [0]),
      ]);

      return [
        streamKey,
        {
          length,
          pending: pendingCountFromResult(pendingResult),
        },
      ] as const;
    }),
  );

  return {
    streams: Object.fromEntries(entries),
  };
}
