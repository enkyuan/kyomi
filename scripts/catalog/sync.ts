import { existsSync, mkdirSync, rmdirSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT_DIR = join(import.meta.dir, "../..");
const LOCK_DIR = join(ROOT_DIR, ".catalog-sync.lock");
const LOG_DIR = join(ROOT_DIR, ".catalog-sync-logs");
const LOG_FILE = join(LOG_DIR, `catalog-sync-${new Date().toISOString().slice(0, 10)}.log`);

async function log(message: string): Promise<void> {
  await appendFile(LOG_FILE, `${message}\n`);
}

async function logStream(stream: ReadableStream<Uint8Array> | null): Promise<void> {
  if (!stream) {
    return;
  }
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      await appendFile(LOG_FILE, decoder.decode(value, { stream: true }));
    }
    const trailing = decoder.decode();
    if (trailing) {
      await appendFile(LOG_FILE, trailing);
    }
  } finally {
    reader.releaseLock();
  }
}

function cleanup(): void {
  if (existsSync(LOCK_DIR)) {
    rmdirSync(LOCK_DIR);
  }
}

async function runCatalogSync(): Promise<number> {
  const proc = Bun.spawn(["bun", "run", "catalog:sync"], {
    cwd: ROOT_DIR,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [, , exitCode] = await Promise.all([
    logStream(proc.stdout),
    logStream(proc.stderr),
    proc.exited,
  ]);

  return exitCode;
}

await mkdir(LOG_DIR, { recursive: true });

try {
  mkdirSync(LOCK_DIR);
} catch {
  await log("[catalog-sync] skipped: another sync is already running");
  process.exit(0);
}

process.once("exit", cleanup);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    cleanup();
    process.kill(process.pid, signal);
  });
}

await log(`[catalog-sync] started at ${new Date().toISOString()}`);
await log(`[catalog-sync] root=${ROOT_DIR}`);

const exitCode = await runCatalogSync();
if (exitCode === 0) {
  await log(`[catalog-sync] finished at ${new Date().toISOString()}`);
} else {
  await log(`[catalog-sync] failed at ${new Date().toISOString()} with exit code ${exitCode}`);
}

process.exitCode = exitCode;
