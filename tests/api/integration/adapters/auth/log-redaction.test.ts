import { afterEach, describe, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@kyomi/db";
import { createAuth } from "@adapters/auth/instance";
import { loadEnv } from "@config/env/runtime";
import type { Database } from "@adapters/db/service";

/**
 * A failed query is reported by drizzle with its bound values in the message. For sign-in those are
 * the one-time code and the email; for a session they are the token. Nothing Better Auth or its
 * router writes may carry them.
 */

const VICTIM = "victim@example.com";
const env = loadEnv({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/kyomi_test",
  REDIS_URL: "redis://127.0.0.1:6379",
  WEB_ORIGIN: "http://localhost:3000",
  BETTER_AUTH_SECRET: "k9Zq!x7Lm2#Vb8Rt4Yw6Uc1Nd3Hf5Jg0Pa",
  BETTER_AUTH_URL: "http://localhost:8000",
});

/** A pg client whose writes fail the way a statement timeout does. */
function failingDb(): Database {
  const client = {
    query: async (config: { text?: string } | string) => {
      const text = typeof config === "string" ? config : (config.text ?? "");
      if (/^\s*insert/i.test(text)) {
        throw Object.assign(new Error("canceling statement due to statement timeout"), {
          code: "57014",
        });
      }
      return { rows: [], rowCount: 0, fields: [], command: "SELECT", oid: 0 };
    },
  };
  return drizzle({ client: client as never, schema }) as unknown as Database;
}

const original = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  stdout: process.stdout.write.bind(process.stdout),
  stderr: process.stderr.write.bind(process.stderr),
};
afterEach(() => {
  Object.assign(console, {
    log: original.log,
    info: original.info,
    warn: original.warn,
    error: original.error,
    debug: original.debug,
  });
  process.stdout.write = original.stdout as never;
  process.stderr.write = original.stderr as never;
});

/** Everything written to the console and the standard streams while `run` runs. */
async function captured(run: () => Promise<unknown>) {
  const lines: string[] = [];
  const record = (...args: unknown[]) => {
    lines.push(
      args
        .map((arg) =>
          typeof arg === "string"
            ? arg
            : arg instanceof Error
              ? `${arg.name}: ${arg.message}`
              : JSON.stringify(arg),
        )
        .join(" "),
    );
  };
  Object.assign(console, { log: record, info: record, warn: record, error: record, debug: record });
  process.stdout.write = ((chunk: unknown) => (lines.push(String(chunk)), true)) as never;
  process.stderr.write = ((chunk: unknown) => (lines.push(String(chunk)), true)) as never;
  let outcome = "";
  try {
    const response = (await run()) as Response;
    outcome = `response ${response.status}`;
  } catch (error) {
    outcome = `threw ${error instanceof Error ? error.name : "error"}`;
  }
  return { outcome, output: lines.join("\n") };
}

const request = (path: string, body: object) =>
  new Request(`http://localhost:8000${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  });

describe("auth failures do not log bound query values", () => {
  test("a failed one-time-code insert leaves the email out of every log line", async () => {
    const auth = createAuth({ config: env, db: failingDb(), sendOtp: () => {} });

    const { output } = await captured(() =>
      auth.handler(
        request("/api/auth/email-otp/send-verification-otp", { email: VICTIM, type: "sign-in" }),
      ),
    );

    expect(output).not.toContain(VICTIM);
  });

  test("client mistakes still answer as before", async () => {
    const auth = createAuth({ config: env, db: failingDb(), sendOtp: () => {} });

    const badEmail = await auth.handler(
      request("/api/auth/email-otp/send-verification-otp", {
        email: "not-an-email",
        type: "sign-in",
      }),
    );
    const unknown = await auth.handler(request("/api/auth/nope", {}));

    expect(badEmail.status).toBe(400);
    expect(unknown.status).toBe(404);
  });
});
