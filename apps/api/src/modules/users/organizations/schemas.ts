import { t } from "elysia";

const membershipItem = t.Object({
  membershipId: t.String(),
  organizationId: t.String(),
  organizationName: t.String(),
  plan: t.String(),
  role: t.String(),
});

export const userMembershipsResponse = t.Object({
  items: t.Array(membershipItem),
});
