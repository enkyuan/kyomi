import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const fixture = join(import.meta.dir, "run-main.fixture.ts");

/** Run the fixture, optionally signalling it once it prints `ready`; resolves with what it did. */
async function runFixture(mode: string, signal?: NodeJS.Signals) {
  const child = Bun.spawn(["bun", fixture, mode], { stdout: "pipe", stderr: "pipe" });
  const decoder = new TextDecoder();
  const reader = child.stdout.getReader();
  let output = "";
  let signalled = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    output += decoder.decode(value);
    if (signal && !signalled && output.includes("ready")) {
      signalled = true;
      child.kill(signal);
    }
  }
  const exitCode = await child.exited;
  // Effect logs a failed main fiber to stdout too; only the fixture's own lines matter here.
  const lines = output.split("\n").filter((line) => /^(acquired|released|ready)/.test(line));
  return { exitCode, lines };
}

const ACQUIRED = ["acquired pool", "acquired redis", "acquired server"];
const RELEASED_IN_REVERSE = ["released server", "released redis", "released pool"];

describe("runMain", () => {
  test("SIGTERM interrupts the main fiber and releases the scope in reverse order, exiting 0", async () => {
    const { exitCode, lines } = await runFixture("wait", "SIGTERM");

    expect(lines).toEqual([...ACQUIRED, "ready", ...RELEASED_IN_REVERSE]);
    expect(exitCode).toBe(0);
  });

  test("SIGINT shuts down the same way", async () => {
    const { exitCode, lines } = await runFixture("wait", "SIGINT");

    expect(lines).toEqual([...ACQUIRED, "ready", ...RELEASED_IN_REVERSE]);
    expect(exitCode).toBe(0);
  });

  test("a failing program still releases its resources and exits non-zero", async () => {
    const { exitCode, lines } = await runFixture("fail");

    expect(lines).toEqual([...ACQUIRED, "ready", ...RELEASED_IN_REVERSE]);
    expect(exitCode).not.toBe(0);
  });
});
