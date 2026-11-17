import { Effect } from "effect";
import { strictPositiveIntFlag, valueAfter } from "../args";
import { InvalidArguments } from "../errors";

export const DEFAULT_IMPORT_BATCH_SIZE = 1_000;

export type CatalogImportOptions = {
  batchSize: number;
};

export type CatalogImportArgs = CatalogImportOptions & {
  input: string;
  dryRun: boolean;
};

/** Parses the `catalog:import` flags; `--input` is required and a bad `--batch-size` fails. */
export const parseCatalogImportArgs = Effect.fn("catalog.import.parseArgs")(function* (
  argv: readonly string[],
) {
  const input = valueAfter(argv, "--input");
  if (!input) {
    return yield* new InvalidArguments({ message: "Missing required --input <jsonl-path>" });
  }
  const args: CatalogImportArgs = {
    input,
    dryRun: argv.includes("--dry-run"),
    batchSize: (yield* strictPositiveIntFlag(argv, "--batch-size")) ?? DEFAULT_IMPORT_BATCH_SIZE,
  };
  return args;
});
