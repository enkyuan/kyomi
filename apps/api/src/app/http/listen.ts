import type { Elysia } from "elysia";
import { logger } from "@adapters/logger";

type ListenRetryOptions = {
  port: number;
  maxRequestBodySize?: number;
  retries?: number;
  retryDelayMs?: number;
  signal?: AbortSignal;
};

export function buildListenOptions(options: { port: number; maxRequestBodySize?: number }): {
  port: number;
  maxRequestBodySize?: number;
} {
  return options.maxRequestBodySize === undefined
    ? { port: options.port }
    : { port: options.port, maxRequestBodySize: options.maxRequestBodySize };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function isAddressInUseError(error: unknown): error is Error & { code?: string } {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code === "EADDRINUSE"
  );
}

export async function listenWithRetry(app: Elysia, options: ListenRetryOptions): Promise<void> {
  const retries = options.retries ?? 0;
  const retryDelayMs = options.retryDelayMs ?? 250;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      app.listen(buildListenOptions(options));
      return;
    } catch (error) {
      const lastAttempt = attempt === retries;
      if (!isAddressInUseError(error) || lastAttempt || options.signal?.aborted) {
        throw error;
      }

      logger.warn("server.port_in_use.retrying", {
        port: options.port,
        attempt: attempt + 1,
        retries,
        retryDelayMs,
      });
      await sleep(retryDelayMs, options.signal);
    }
  }
}
