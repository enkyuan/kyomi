import { eq, inArray } from "drizzle-orm";
import { feeds, userOnboarding, users } from "@kyomi/db";
import { Effect } from "effect";
import { Db, type Database } from "@adapters/db/service";
import { CurrentUser } from "@shared/effect/request";
import { currentDate } from "@shared/effect/clock";
import { inTransaction, subscribeUserToFeed } from "@modules/feeds/subscription/persistence";
import { Conflict } from "@shared/effect/errors";
import { bundles } from "./options";
import { form, handle, invalidForm, patch } from "./schemas";

type Draft = typeof userOnboarding.$inferSelect.draft;

function state(draft: Draft, completedAt: Date | null) {
  const fields = ["name", "username", "categories", "language", "bundleIds"] as const;
  return {
    status: completedAt ? "complete" : "pending",
    draft,
    completedAt,
    nextField: completedAt ? null : (fields.find((field) => !draft[field]) ?? null),
  };
}

async function readState(database: Pick<Database, "query">, userId: string) {
  const row = await database.query.userOnboarding.findFirst({
    where: eq(userOnboarding.userId, userId),
  });
  return state(row?.draft ?? {}, row?.completedAt ?? null);
}

export const getState = Effect.gen(function* () {
  const { userId } = yield* CurrentUser;
  const db = yield* Db;
  return yield* db.use("onboarding.read", (client) => readState(client, userId));
});

export const availability = Effect.fn("onboarding.availability")(function* (input: unknown) {
  const result = handle.safeParse(input);
  if (!result.success) return yield* invalidForm(result.error);
  const username = result.data;
  const db = yield* Db;
  const claimed = yield* db.use("onboarding.lookup", (client) =>
    client.query.userOnboarding.findFirst({
      columns: { username: true },
      where: eq(userOnboarding.username, username),
    }),
  );
  return { username, available: !claimed };
});

export const save = Effect.fn("onboarding.save")(function* (
  action: { type: "patch"; body: unknown } | { type: "complete" },
) {
  const changes = action.type === "patch" ? patch.safeParse(action.body) : undefined;
  if (changes && !changes.success) return yield* invalidForm(changes.error);
  const { userId } = yield* CurrentUser;
  const now = yield* currentDate;
  return yield* inTransaction("onboarding.save", async (tx) => {
    // Lock a row that exists even on the first request from two different sessions.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    const current = await readState(tx, userId);
    if (current.completedAt) {
      if (action.type === "complete") return current;
      throw new Conflict({
        message: "Onboarding is already complete.",
        code: "ONBOARDING_COMPLETE",
      });
    }
    const draft = { ...current.draft, ...changes?.data };
    if (action.type === "patch") {
      await tx
        .insert(userOnboarding)
        .values({ userId, draft })
        .onConflictDoUpdate({ target: userOnboarding.userId, set: { draft } });
      return state(draft, null);
    }
    const result = form.safeParse(draft);
    if (!result.success) throw invalidForm(result.error);
    const validated = result.data;
    const completedAt = now;
    await tx
      .update(userOnboarding)
      .set({ username: validated.username, completedAt })
      .where(eq(userOnboarding.userId, userId));
    await tx
      .update(users)
      .set({ name: validated.name, updatedAt: completedAt })
      .where(eq(users.id, userId));
    const selected = bundles
      .filter((bundle) => validated.bundleIds.includes(bundle.id))
      .flatMap((bundle) => [...bundle.feeds]);
    await tx
      .insert(feeds)
      .values(
        selected.map((feed) => ({
          ...feed,
          canonicalFeedUrl: feed.url,
          id: crypto.randomUUID(),
        })),
      )
      .onConflictDoNothing({ target: feeds.url });
    const rows = await tx
      .select({ id: feeds.id })
      .from(feeds)
      .where(
        inArray(
          feeds.url,
          selected.map((feed) => feed.url),
        ),
      );
    for (const feed of rows) await subscribeUserToFeed(tx, userId, feed.id, now);
    return state(draft, completedAt);
  }).pipe(
    Effect.mapError((error) => {
      if (error._tag !== "DatabaseError") return error;
      const cause = error.cause instanceof Error ? error.cause.cause : null;
      if (
        cause &&
        typeof cause === "object" &&
        "constraint" in cause &&
        cause.constraint === "user_onboarding_username_key"
      ) {
        return new Conflict({
          message: "This username is taken.",
          code: "USERNAME_TAKEN",
          details: { field: "username" },
        });
      }
      return error;
    }),
  );
});
