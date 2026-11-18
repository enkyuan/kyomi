/**
 * How one stop window is spent when the worker is asked to stop. `SHUTDOWN_BUDGET_MS` is the whole
 * window and the compose `stop_grace_period` for the worker is set to match; everything below is
 * derived from it, so the stages cannot add up to more than the process is given:
 *
 *   drain      running jobs finish on their own
 *   settle     a job interrupted at the end of the drain gets this long for its Promise to settle
 *              (feed ingestion takes no abort signal, so the Promise runs on until it does)
 *   reserve    closing the shared Redis and Postgres clients and flushing logs
 *
 * A job that is cut off is not lost: its stream entry stays pending and is claimed again after the
 * stream's pending-idle time.
 */

/** After the jobs have stopped: closing the clients, flushing logs, exiting. */
const CLOSE_RESERVE_MS = 5_000;
/** What an interrupted job's Promise gets to settle before it is abandoned. */
export const INTERRUPTED_JOB_SETTLE_MS = 2_000;
const MIN_DRAIN_MS = 1_000;

export type ShutdownWindows = {
  /** How long running jobs have to finish after a stop request. */
  readonly drainMs: number;
  /** How long an interrupted job's Promise has to settle. */
  readonly settleMs: number;
};

export function shutdownWindows(budgetMs: number): ShutdownWindows {
  return {
    drainMs: Math.max(MIN_DRAIN_MS, budgetMs - INTERRUPTED_JOB_SETTLE_MS - CLOSE_RESERVE_MS),
    settleMs: INTERRUPTED_JOB_SETTLE_MS,
  };
}
