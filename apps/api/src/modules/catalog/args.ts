import { Effect } from "effect";
import { valueAfter } from "@shared/cli/args";
import { InvalidArguments } from "./errors";

/** A positive integer, or `fallback` when the value is missing or malformed. */
export function positiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * A positive integer flag that must be well formed when present. A typo is a failure, not a
 * fallback: it would otherwise be indistinguishable from an explicit unbounded `--apply` run.
 */
export const strictPositiveIntFlag = Effect.fn("catalog.args.positiveInt")(function* (
  argv: readonly string[],
  flag: string,
) {
  const value = valueAfter(argv, flag);
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return yield* new InvalidArguments({ message: `Invalid ${flag} value: ${value}` });
  }
  return parsed;
});
