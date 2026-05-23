import { feeds } from "@vols.rss/db";
import { db, pool } from "@adapters/db/client";
import { assertApiDatabaseReady } from "@adapters/db/script-preflight";
import { upsertFeedSearchDocument } from "@adapters/search/meili";
import { assertHttpOrHttpsUrl, normalizeFeedUrl } from "@modules/discover/feed/normalize-url";

type CatalogFeedRecord = {
  feed_url: string;
  title?: string | null;
  description?: string | null;
  link?: string | null;
};

type ImportStats = {
  processed: number;
  imported: number;
  skipped: number;
  failed: number;
};

type NormalizedImportRecord = {
  canonicalUrl: string;
  title: string;
  description: string | null;
  link: string | null;
};

function getArgValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function parseRecord(line: string): CatalogFeedRecord | null {
  const raw = line.trim();
  if (!raw) {
    return null;
  }
  const parsed = JSON.parse(raw) as Partial<CatalogFeedRecord>;
  if (typeof parsed.feed_url !== "string" || parsed.feed_url.trim().length === 0) {
    return null;
  }
  return {
    feed_url: parsed.feed_url.trim(),
    title: typeof parsed.title === "string" ? parsed.title.trim() : null,
    description: typeof parsed.description === "string" ? parsed.description.trim() : null,
    link: typeof parsed.link === "string" ? parsed.link.trim() : null,
  };
}

function resolveCanonicalUrl(raw: string): string {
  const asserted = assertHttpOrHttpsUrl(raw);
  return normalizeFeedUrl(asserted.href);
}

function normalizeImportRecord(record: CatalogFeedRecord): NormalizedImportRecord {
  const canonicalUrl = resolveCanonicalUrl(record.feed_url);
  return {
    canonicalUrl,
    title: record.title && record.title.length > 0 ? record.title : canonicalUrl,
    description: record.description && record.description.length > 0 ? record.description : null,
    link: record.link && record.link.length > 0 ? record.link : null,
  };
}

async function upsertCatalogFeed(record: NormalizedImportRecord): Promise<boolean> {
  const now = new Date();
  const rows = await db
    .insert(feeds)
    .values({
      id: crypto.randomUUID(),
      url: record.canonicalUrl,
      title: record.title,
      description: record.description,
      link: record.link,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: feeds.url,
      set: {
        title: record.title,
        description: record.description,
        link: record.link,
        updatedAt: now,
      },
    })
    .returning({
      id: feeds.id,
      url: feeds.url,
      title: feeds.title,
      description: feeds.description,
      link: feeds.link,
    });

  const upserted = rows[0];
  if (!upserted) {
    return false;
  }

  await upsertFeedSearchDocument({
    id: upserted.id,
    url: upserted.url,
    title: upserted.title,
    description: upserted.description,
    link: upserted.link,
  }).catch(() => undefined);

  return true;
}

async function* readLines(filePath: string): AsyncIterable<string> {
  const stream = Bun.file(filePath).stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        yield line;
      }
    }
    // Flush any remaining bytes
    buffer += decoder.decode();
    if (buffer) {
      yield buffer;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Stream may already be closed; ignore cleanup errors
    }
  }
}

async function importCatalogFile(inputPath: string, dryRun: boolean): Promise<ImportStats> {
  const stats: ImportStats = { processed: 0, imported: 0, skipped: 0, failed: 0 };

  for await (const line of readLines(inputPath)) {
    if (!line.trim()) {
      continue;
    }
    stats.processed += 1;

    let record: CatalogFeedRecord | null = null;
    try {
      record = parseRecord(line);
    } catch {
      stats.failed += 1;
      continue;
    }
    if (!record) {
      stats.skipped += 1;
      continue;
    }

    let normalized: NormalizedImportRecord;
    try {
      normalized = normalizeImportRecord(record);
    } catch {
      stats.failed += 1;
      continue;
    }

    if (dryRun) {
      stats.imported += 1;
      continue;
    }

    const ok = await upsertCatalogFeed(normalized);
    if (!ok) {
      stats.failed += 1;
      continue;
    }

    stats.imported += 1;
  }

  return stats;
}

async function main() {
  const input = getArgValue("--input");
  if (!input) {
    throw new Error("Missing required --input <jsonl-path>");
  }

  const dryRun = hasFlag("--dry-run");
  if (!dryRun) {
    await assertApiDatabaseReady({
      commandName: "catalog:import",
      ensureSchema: true,
    });
  }
  const stats = await importCatalogFile(input, dryRun);

  console.log(
    JSON.stringify(
      {
        input,
        dryRun,
        ...stats,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    const maybeCause =
      typeof error === "object" &&
      error !== null &&
      "cause" in error &&
      (error as { cause?: unknown }).cause
        ? (error as { cause?: unknown }).cause
        : null;

    console.error(
      "[catalog-import] failed:",
      error instanceof Error ? error.message : String(error),
    );
    if (maybeCause) {
      console.error("[catalog-import] cause:", maybeCause);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
