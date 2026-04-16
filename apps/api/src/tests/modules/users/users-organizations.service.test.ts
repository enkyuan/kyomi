import { describe, expect, mock, test } from "bun:test";
import { listMembershipsForUser } from "@modules/users/users-organizations.service";

describe("users-organizations.service", () => {
  test("listMembershipsForUser returns joined rows", async () => {
    const row = {
      membershipId: "mem_1",
      organizationId: "org_1",
      organizationName: "Acme",
      plan: "team",
      role: "admin",
    };
    const where = mock(() => Promise.resolve([row]));
    const innerJoin = mock(() => ({ where }));
    const from = mock(() => ({ innerJoin }));
    const select = mock(() => ({ from }));
    const fakeDb = { select } as unknown as Parameters<typeof listMembershipsForUser>[0];

    const items = await listMembershipsForUser(fakeDb, "user_1");
    expect(items).toEqual([row]);
    expect(select).toHaveBeenCalled();
  });
});
