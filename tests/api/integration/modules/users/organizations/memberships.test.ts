import { describe, expect, mock, test } from "bun:test";
import { Effect, Layer } from "effect";
import { listMemberships } from "@modules/users/organizations/memberships";
import { CurrentUser } from "@shared/effect/request";
import { fakeDb } from "@api-tests/support/layers";

describe("users organization memberships", () => {
  test("listMemberships returns the current user's joined rows", async () => {
    const row = {
      membershipId: "mem_1",
      organizationId: "org_1",
      organizationName: "Acme",
      plan: "team",
      role: "admin",
    };
    const where = mock((_condition: unknown) => Promise.resolve([row]));
    const select = mock(() => ({ from: () => ({ innerJoin: () => ({ where }) }) }));

    const items = await Effect.runPromise(
      listMemberships.pipe(
        Effect.provide(
          Layer.mergeAll(fakeDb({ select }), Layer.succeed(CurrentUser, { userId: "user_1" })),
        ),
      ),
    );

    expect(items).toEqual([row]);
    expect(select).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
  });

  test("a database failure is a typed DatabaseError", async () => {
    const select = () => {
      throw new Error("connection reset");
    };

    const failure = await Effect.runPromise(
      Effect.flip(listMemberships).pipe(
        Effect.provide(
          Layer.mergeAll(fakeDb({ select }), Layer.succeed(CurrentUser, { userId: "user_1" })),
        ),
      ),
    );

    expect(failure).toMatchObject({ _tag: "DatabaseError", operation: "users.memberships.list" });
  });
});
