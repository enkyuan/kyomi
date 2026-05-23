import { and, eq, ne } from "drizzle-orm";
import { users } from "@vols.rss/db";
import { normalizeEmail } from "@/lib/email";
import type { db } from "@adapters/db/client";
import { AppError } from "@shared/errors/app";
import type { UserProfileDto } from "./types";

type DB = typeof db;

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

export async function getUserProfileById(
  database: DB,
  userId: string,
): Promise<UserProfileDto | null> {
  const row = await database.query.users.findFirst({
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
  });

  return row ? rowToUserProfile(row) : null;
}

export async function updateUserEmailById(
  database: DB,
  userId: string,
  emailInput: string,
): Promise<UserProfileDto> {
  const email = normalizeEmail(emailInput);
  if (!email) {
    throw new AppError("Enter a valid email address.", {
      status: 400,
      code: "USER_EMAIL_INVALID",
    });
  }

  const conflictingUser = await database.query.users.findFirst({
    where: and(eq(users.email, email), ne(users.id, userId)),
    columns: { id: true },
  });

  if (conflictingUser) {
    throw new AppError("This email is already in use.", {
      status: 409,
      code: "USER_EMAIL_CONFLICT",
    });
  }

  const [updatedRow] = await database
    .update(users)
    .set({
      email,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      image: users.image,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  if (!updatedRow) {
    throw new AppError("User not found", { status: 404, code: "USER_NOT_FOUND" });
  }

  return rowToUserProfile(updatedRow);
}
