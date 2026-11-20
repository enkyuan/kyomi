import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { memberships, organizations } from "@kyomi/db";
import { Db } from "@adapters/db/service";
import { CurrentUser } from "@shared/effect/request";

export const listMemberships = Effect.gen(function* () {
  const { userId } = yield* CurrentUser;
  const db = yield* Db;
  return yield* db.use("users.memberships.list", (client) =>
    client
      .select({
        membershipId: memberships.id,
        organizationId: organizations.id,
        organizationName: organizations.name,
        plan: organizations.plan,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
      .where(eq(memberships.userId, userId)),
  );
});
