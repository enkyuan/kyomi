import { buildQueueHealthSnapshot } from "@app/jobs/queue-health";
import { getRedis, closeRedis } from "@adapters/redis";

try {
  const snapshot = await buildQueueHealthSnapshot(getRedis());
  console.log(JSON.stringify(snapshot, null, 2));
} finally {
  await closeRedis();
}
