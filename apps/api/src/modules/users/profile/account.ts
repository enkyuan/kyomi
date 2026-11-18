import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { users } from "@kyomi/db";
import { Db } from "@adapters/db/service";
import { NotFound } from "@shared/effect/errors";
import { CurrentUser } from "@shared/effect/request";
import type { UserProfileDto } from "./types";

const userNotFound = () => new NotFound({ message: "User not found", code: "USER_NOT_FOUND" });

function rowToUserProfile(row: {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}): UserProfileDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    image: row.image,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const getUserProfile = Effect.gen(function* () {
  const { userId } = yield* CurrentUser;
  const db = yield* Db;
  const row = yield* db.use("users.profile.get", (client) =>
    client.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  );
  if (!row) {
    return yield* userNotFound();
  }
  return rowToUserProfile(row);
});
