import { getRedis, closeRedis } from "../../apps/api/src/adapters/redis";
import { buildQueueHealthSnapshot } from "../../apps/api/src/app/jobs/queue-health";

try {
  const snapshot = await buildQueueHealthSnapshot(getRedis());
  console.log(JSON.stringify(snapshot, null, 2));
} finally {
  await closeRedis();
}
