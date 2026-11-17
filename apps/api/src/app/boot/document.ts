import { Data, Effect } from "effect";
import {
  DOCUMENT_BACKFILL_SCOPES,
  runDocumentBackfillScope,
  type DocumentBackfillScope,
} from "@modules/articles/document/backfill";
import { currentCompilerVersion } from "@kyomi/ingest/lib/stored-document";
import { AppLogger } from "@adapters/logger/service";
import { AppLive } from "../runtime";
import { runMain } from "../setup/main";
import { ensureDatabaseReady } from "../setup/ready";

/** The run finished but some rows produced no document; the process exits non-zero. */
class DocumentBackfillIncomplete extends Data.TaggedError("DocumentBackfillIncomplete")<{
  readonly failed: number;
}> {}

class NoDocumentCompiler extends Data.TaggedError("NoDocumentCompiler")<{}> {
  override get message() {
    return "no document compiler is wired; nothing to do";
  }
}

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

const backfill = Effect.gen(function* () {
  const log = yield* AppLogger;
  const args = yield* Effect.try(() => parseDocumentBackfillArgs(process.argv));
  const compilerVersion = currentCompilerVersion();
  if (!compilerVersion) {
    return yield* new NoDocumentCompiler();
  }
  yield* ensureDatabaseReady({ commandName: "content:document-backfill" });
  let failed = 0;
  for (const scope of args.scopes) {
    const result = yield* runDocumentBackfillScope(scope, { ...args, compilerVersion });
    yield* log.info("document.backfill.scope_done", result);
    failed += result.failed;
  }
  yield* log.info("document.backfill.done", { mode: args.apply ? "applied" : "dry_run", failed });
  if (failed > 0) {
    return yield* new DocumentBackfillIncomplete({ failed });
  }
});

// The layer scope closes Postgres and Redis once the run ends, or on SIGINT/SIGTERM.
if (import.meta.main) {
  runMain(backfill.pipe(Effect.provide(AppLive)));
}
