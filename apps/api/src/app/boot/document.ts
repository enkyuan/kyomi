import { db, pool } from "@adapters/db/client";
import { assertApiDatabaseReady } from "@adapters/db/preflight";
import {
  DOCUMENT_BACKFILL_SCOPES,
  runDocumentBackfillScope,
  type DocumentBackfillScope,
} from "@modules/articles/document/backfill";
import { currentCompilerVersion } from "@kyomi/worker/lib/stored-document";

function flagValue(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  const value = index === -1 ? undefined : argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function intFlag(argv: string[], flag: string, fallback: number, min: number, max: number) {
  const value = flagValue(argv, flag);
  if (value === null) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid ${flag} value: ${value} (expected ${min}..${max})`);
  }
  return parsed;
}

export function parseDocumentBackfillArgs(argv: string[]) {
  const scopes: DocumentBackfillScope[] = [];
  argv.forEach((arg, index) => {
    if (arg !== "--scope") {
      return;
    }
    const value = argv[index + 1];
    if (!value || !(DOCUMENT_BACKFILL_SCOPES as readonly string[]).includes(value)) {
      throw new Error(`Invalid --scope value: ${value ?? ""}`);
    }
    scopes.push(value as DocumentBackfillScope);
  });
  return {
    apply: argv.includes("--apply"),
    batchSize: intFlag(argv, "--batch-size", 100, 1, 500),
    sleepMs: intFlag(argv, "--sleep-ms", 100, 0, 10_000),
    afterId: flagValue(argv, "--after-id"),
    scopes: scopes.length > 0 ? scopes : [...DOCUMENT_BACKFILL_SCOPES],
  };
}

if (import.meta.main) {
  const args = parseDocumentBackfillArgs(process.argv);
  const compilerVersion = currentCompilerVersion();
  if (!compilerVersion) {
    console.error("[content:document-backfill] no document compiler is wired; nothing to do");
    process.exit(1);
  }
  try {
    await assertApiDatabaseReady({ commandName: "content:document-backfill" });
    let failed = 0;
    for (const scope of args.scopes) {
      const result = await runDocumentBackfillScope(db, scope, {
        ...args,
        compilerVersion,
        log: console.log,
      });
      console.log(JSON.stringify(result));
      failed += result.failed;
    }
    console.log(`${args.apply ? "APPLIED" : "DRY RUN"}: failed ${failed}`);
    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}
