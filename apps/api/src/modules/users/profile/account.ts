import { Effect } from "effect";
import { and, eq, ne } from "drizzle-orm";
import { users } from "@kyomi/db";
import { Db } from "@adapters/db/service";
import { BadRequest, Conflict, NotFound } from "@shared/effect/errors";
import { currentDate } from "@shared/effect/clock";
import { CurrentUser } from "@shared/effect/request";
import { normalizeEmail } from "./email";
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

export const updateUserEmail = Effect.fn("users.profile.updateEmail")(function* (
  emailInput: string,
) {
  const { userId } = yield* CurrentUser;
  const db = yield* Db;
  const email = normalizeEmail(emailInput);
  if (!email) {
    return yield* new BadRequest({
      message: "Enter a valid email address.",
      code: "USER_EMAIL_INVALID",
    });
  }

  const conflictingUser = yield* db.use("users.profile.emailConflict", (client) =>
    client.query.users.findFirst({
      where: and(eq(users.email, email), ne(users.id, userId)),
      columns: { id: true },
    }),
  );
  if (conflictingUser) {
    return yield* new Conflict({
      message: "This email is already in use.",
      code: "USER_EMAIL_CONFLICT",
    });
  }

  const now = yield* currentDate;
  const [updatedRow] = yield* db.use("users.profile.updateEmail", (client) =>
    client.update(users).set({ email, updatedAt: now }).where(eq(users.id, userId)).returning({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      image: users.image,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    }),
  );
  if (!updatedRow) {
    return yield* userNotFound();
  }
  return rowToUserProfile(updatedRow);
});
