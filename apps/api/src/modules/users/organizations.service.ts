import { eq } from "drizzle-orm";
import { memberships, organizations } from "@cronos/db";
import type { db } from "@adapters/db/client";
import type { OrganizationMembershipDto } from "./organizations.types";

type DB = typeof db;

export async function listMembershipsForUser(
  database: DB,
  userId: string,
): Promise<OrganizationMembershipDto[]> {
  const rows = await database
    .select({
      membershipId: memberships.id,
      organizationId: organizations.id,
      organizationName: organizations.name,
      plan: organizations.plan,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.userId, userId));

  return rows;
}
