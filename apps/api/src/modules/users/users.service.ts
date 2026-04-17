import { and, eq, ne } from "drizzle-orm";
import { users } from "@cronos/db";
import type { db } from "@adapters/db/client";
import { AppError } from "@shared/errors/app-error";
import type { UserProfileDto } from "./users.types";

type DB = typeof db;

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

  if (!row) {
    return null;
  }

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

export async function updateUserEmailById(
  database: DB,
  userId: string,
  emailInput: string,
): Promise<UserProfileDto> {
  const email = emailInput.trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || !emailPattern.test(email)) {
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

  return {
    id: updatedRow.id,
    name: updatedRow.name,
    email: updatedRow.email,
    emailVerified: updatedRow.emailVerified,
    image: updatedRow.image,
    createdAt: updatedRow.createdAt.toISOString(),
    updatedAt: updatedRow.updatedAt.toISOString(),
  };
}
