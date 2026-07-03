import type { OpmlImportStatusDto } from "@lib/schemas/index";
import { getOpmlImportStatus } from "./api";

const DEFAULT_OPML_IMPORT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_OPML_IMPORT_POLL_TIMEOUT_MS = 30 * 60_000;

type PollOpmlImportStatusOptions = {
  intervalMs?: number;
  timeoutMs?: number;
  onStatus?: (status: OpmlImportStatusDto) => void;
  getStatus?: (taskId: string) => Promise<OpmlImportStatusDto>;
};

function normalizeUrlCandidate(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (!parsed.hostname) {
      return null;
    }
    if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function hasOpmlUrlSignal(url: URL): boolean {
  const pathname = url.pathname.toLowerCase();
  const search = url.search.toLowerCase();
  return pathname.endsWith(".opml") || pathname.includes("opml") || search.includes("opml");
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

async function defaultGetStatus(taskId: string): Promise<OpmlImportStatusDto> {
  return getOpmlImportStatus({ data: { taskId } });
}

export function getOpmlImportUrlCandidate(value: string): string | null {
  const url = normalizeUrlCandidate(value);
  if (!url || !hasOpmlUrlSignal(url)) {
    return null;
  }
  return url.toString();
}

export function isTerminalOpmlImportStatus(status: OpmlImportStatusDto["status"]): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function getImportedCount(status: OpmlImportStatusDto): number {
  return status.summary.subscribed + status.summary.alreadySubscribed;
}

export async function pollOpmlImportStatus(
  taskId: string,
  options: PollOpmlImportStatusOptions = {},
): Promise<OpmlImportStatusDto> {
  const intervalMs = options.intervalMs ?? DEFAULT_OPML_IMPORT_POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_OPML_IMPORT_POLL_TIMEOUT_MS;
  const getStatus = options.getStatus ?? defaultGetStatus;
  const startedAt = Date.now();

  const pollNextStatus = async (): Promise<OpmlImportStatusDto> => {
    const status = await getStatus(taskId);
    options.onStatus?.(status);
    if (isTerminalOpmlImportStatus(status.status)) {
      return status;
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("OPML import is still running. Check back in a moment.");
    }
    await wait(intervalMs);
    return pollNextStatus();
  };

  return pollNextStatus();
}
