import { describe, expect, test } from "bun:test";
import path from "node:path";
import { emailOtpPlugin } from "@adapters/auth/email-otp";
import type { EmailOTPMessage } from "@adapters/auth/otp";

// Better Auth keeps request state in module scope, so the test loads the same copy the plugin
// imports instead of a separately resolved one.
const authAdapterDir = path.dirname(Bun.resolveSync("@adapters/auth/email-otp", import.meta.dir));
const { betterAuth } = await import(Bun.resolveSync("better-auth", authAdapterDir));
const { memoryAdapter } = await import(
  Bun.resolveSync("better-auth/adapters/memory", authAdapterDir)
);

const ORIGIN = "http://auth.kyomi.test";

type Row = Record<string, unknown>;
type TestDatabase = Record<"user" | "session" | "account" | "verification", Row[]>;

/** The real plugin, as `createAuth` configures it, over an in-memory database. */
function createTestAuth() {
  const db: TestDatabase = { user: [], session: [], account: [], verification: [] };
  const outbox: EmailOTPMessage[] = [];
  const auth: { handler: (request: Request) => Promise<Response> } = betterAuth({
    baseURL: ORIGIN,
    secret: "email-otp-integration-test-secret",
    database: memoryAdapter(db),
    rateLimit: { enabled: false },
    plugins: [emailOtpPlugin((message) => outbox.push(message))],
  });

  const post = (route: string, body: object, cookie = "") =>
    auth.handler(
      new Request(`${ORIGIN}/api/auth${route}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN, cookie },
        body: JSON.stringify(body),
      }),
    );

  /**
   * Better Auth hands a code to the sender in the background, so the response can arrive before the
   * message does. Waits for the one the request caused.
   */
  async function nextMessage(request: () => Promise<Response>) {
    const before = outbox.length;
    const response = await request();
    for (let waited = 0; outbox.length === before && waited < 2_000; waited += 10) {
      await Bun.sleep(10);
    }
    return { response, message: outbox.length > before ? outbox.at(-1) : undefined };
  }

  /** Signs in by code, the way every account is created, and returns the session cookie. */
  async function signIn(email: string) {
    const { message: sent } = await nextMessage(() =>
      post("/email-otp/send-verification-otp", { email, type: "sign-in" }),
    );
    expect(sent?.to).toBe(email);
    const response = await post("/sign-in/email-otp", { email, otp: sent!.otp });
    expect(response.status).toBe(200);
    return response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
  }

  return {
    db,
    outbox,
    post,
    signIn,
    nextMessage,
    userEmails: () => db.user.map((row) => row.email),
  };
}

const OWNER = "owner@example.com";
const NEW = "new@example.com";

describe("changing the account email", () => {
  test("a signed-in user cannot take an address by asking for it", async () => {
    const { post, signIn, userEmails } = createTestAuth();
    const cookie = await signIn(OWNER);

    const direct = await post("/email-otp/change-email", { newEmail: NEW, otp: "000000" }, cookie);
    const updateUser = await post("/update-user", { email: NEW }, cookie);

    expect(direct.status).toBe(400);
    expect(updateUser.status).not.toBe(200);
    expect(userEmails()).toEqual([OWNER]);
  });

  test("the confirmation code goes to the new address, so it proves the address is theirs", async () => {
    const { outbox, nextMessage, post, signIn } = createTestAuth();
    const cookie = await signIn(OWNER);

    const { response, message } = await nextMessage(() =>
      post("/email-otp/request-email-change", { newEmail: NEW }, cookie),
    );

    expect(response.status).toBe(200);
    expect(message).toMatchObject({ to: NEW, purpose: "change-email" });
    expect(
      outbox.filter((sent) => sent.to === OWNER && sent.purpose === "change-email"),
    ).toHaveLength(0);
  });

  test("a wrong code leaves the address alone, and the right one changes it and verifies it", async () => {
    const { db, nextMessage, post, signIn, userEmails } = createTestAuth();
    const cookie = await signIn(OWNER);
    const requested = await nextMessage(() =>
      post("/email-otp/request-email-change", { newEmail: NEW }, cookie),
    );
    const otp = requested.message!.otp;

    const wrong = await post(
      "/email-otp/change-email",
      { newEmail: NEW, otp: otp === "000000" ? "111111" : "000000" },
      cookie,
    );
    expect(wrong.status).toBe(400);
    expect(userEmails()).toEqual([OWNER]);

    // The one wrong attempt did not use the code up.
    const right = await post("/email-otp/change-email", { newEmail: NEW, otp }, cookie);

    expect(right.status).toBe(200);
    expect(db.user[0]).toMatchObject({ email: NEW, emailVerified: true });
  });

  test("asking for an address another account holds sends nothing and does not say so", async () => {
    const { outbox, post, signIn, userEmails } = createTestAuth();
    await signIn("taken@example.com");
    const cookie = await signIn(OWNER);
    const sentBefore = outbox.length;

    const response = await post(
      "/email-otp/request-email-change",
      { newEmail: "taken@example.com" },
      cookie,
    );
    // A message, if one were going to be sent, is sent in the background.
    await Bun.sleep(100);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(outbox).toHaveLength(sentBefore);
    expect(userEmails()).toEqual(["taken@example.com", OWNER]);
  });
});
