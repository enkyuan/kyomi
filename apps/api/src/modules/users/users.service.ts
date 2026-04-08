import { eq } from "drizzle-orm";
import { users } from "@cronos/db";
import type { db } from "@adapters/db/client";
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
