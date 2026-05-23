import { t } from "elysia";

export const userProfileResponse = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.String(),
  emailVerified: t.Boolean(),
  image: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const updateEmailBody = t.Object({
  email: t.String(),
});
