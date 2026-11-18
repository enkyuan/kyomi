import { createAppRuntime } from "@app/runtime";
import { queueHealth } from "@modules/health/queue";

const runtime = createAppRuntime();
try {
  const snapshot = await runtime.runPromise(queueHealth);
  console.log(JSON.stringify(snapshot, null, 2));
} finally {
  await runtime.dispose();
}
