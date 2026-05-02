import type { Elysia } from "elysia";
import { t } from "elysia";
import { AppError } from "@shared/errors/app-error";
import { v1HandlerContext } from "@shared/http/v1-handler-context";
import { listMembershipsForUser } from "./organizations.service";
import {
  getUserPreferences,
  getUserProfileById,
  updateUserEmailById,
  updateUserPreferences,
} from "./service";

const userProfileResponse = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.String(),
  emailVerified: t.Boolean(),
  image: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
  updatedAt: t.String(),
});

const membershipItem = t.Object({
  membershipId: t.String(),
  organizationId: t.String(),
  organizationName: t.String(),
  plan: t.String(),
  role: t.String(),
});

const userMembershipsResponse = t.Object({
  items: t.Array(membershipItem),
});

const updateEmailBody = t.Object({
  email: t.String(),
});

const userPreferencesResponse = t.Object({
  defaultMode: t.Union([t.Literal("smart"), t.Literal("original"), t.Literal("extracted")]),
  fontSizePx: t.Number(),
  contentWidth: t.Union([t.Literal("narrow"), t.Literal("medium"), t.Literal("wide")]),
  openLinksInNewTab: t.Boolean(),
  showImages: t.Boolean(),
  inboxDefaultView: t.Union([
    t.Literal("inbox"),
    t.Literal("today"),
    t.Literal("unread"),
    t.Literal("saved"),
  ]),
  inboxDensity: t.Union([t.Literal("comfortable"), t.Literal("compact")]),
  articleOpenBehavior: t.Union([t.Literal("split"), t.Literal("reader"), t.Literal("original")]),
  inboxMarkReadBehavior: t.Union([
    t.Literal("on-open"),
    t.Literal("after-delay"),
    t.Literal("manual"),
  ]),
  inboxTimestampDisplay: t.Union([t.Literal("absolute"), t.Literal("relative")]),
  inboxTimestampHourCycle: t.Union([t.Literal("12h"), t.Literal("24h")]),
  inboxFontSizePx: t.Number({ minimum: 14, maximum: 20 }),
  inboxShowRecents: t.Boolean(),
  inboxShowFavicons: t.Boolean(),
});

const updateUserPreferencesBody = t.Object({
  defaultMode: t.Optional(
    t.Union([t.Literal("smart"), t.Literal("original"), t.Literal("extracted")]),
  ),
  fontSizePx: t.Optional(t.Number({ minimum: 14, maximum: 22 })),
  contentWidth: t.Optional(t.Union([t.Literal("narrow"), t.Literal("medium"), t.Literal("wide")])),
  openLinksInNewTab: t.Optional(t.Boolean()),
  showImages: t.Optional(t.Boolean()),
  inboxDefaultView: t.Optional(
    t.Union([t.Literal("inbox"), t.Literal("today"), t.Literal("unread"), t.Literal("saved")]),
  ),
  inboxDensity: t.Optional(t.Union([t.Literal("comfortable"), t.Literal("compact")])),
  articleOpenBehavior: t.Optional(
    t.Union([t.Literal("split"), t.Literal("reader"), t.Literal("original")]),
  ),
  inboxMarkReadBehavior: t.Optional(
    t.Union([t.Literal("on-open"), t.Literal("after-delay"), t.Literal("manual")]),
  ),
  inboxTimestampDisplay: t.Optional(t.Union([t.Literal("absolute"), t.Literal("relative")])),
  inboxTimestampHourCycle: t.Optional(t.Union([t.Literal("12h"), t.Literal("24h")])),
  inboxFontSizePx: t.Optional(t.Number({ minimum: 14, maximum: 20 })),
  inboxShowRecents: t.Optional(t.Boolean()),
  inboxShowFavicons: t.Optional(t.Boolean()),
});

export function registerUserRoutes(app: Elysia) {
  return app
    .get(
      "/me/preferences",
      async (context) => {
        const { db, userId } = v1HandlerContext(context);
        return getUserPreferences(db, userId);
      },
      {
        response: {
          200: userPreferencesResponse,
        },
      },
    )
    .patch(
      "/me/preferences",
      async (context) => {
        const { db, userId, body } = v1HandlerContext<{
          defaultMode?: "smart" | "original" | "extracted";
          fontSizePx?: number;
          contentWidth?: "narrow" | "medium" | "wide";
          openLinksInNewTab?: boolean;
          showImages?: boolean;
          inboxDefaultView?: "inbox" | "today" | "unread" | "saved";
          inboxDensity?: "comfortable" | "compact";
          articleOpenBehavior?: "split" | "reader" | "original";
          inboxMarkReadBehavior?: "on-open" | "after-delay" | "manual";
          inboxTimestampDisplay?: "absolute" | "relative";
          inboxTimestampHourCycle?: "12h" | "24h";
          inboxFontSizePx?: number;
          inboxShowRecents?: boolean;
          inboxShowFavicons?: boolean;
        }>(context);
        return updateUserPreferences(db, userId, body);
      },
      {
        body: updateUserPreferencesBody,
        response: {
          200: userPreferencesResponse,
        },
      },
    )
    .get(
      "/users/profile",
      async (context) => {
        const { db, userId } = v1HandlerContext(context);
        const profile = await getUserProfileById(db, userId);
        if (!profile) {
          throw new AppError("User not found", { status: 404, code: "USER_NOT_FOUND" });
        }
        return profile;
      },
      {
        response: {
          200: userProfileResponse,
        },
      },
    )
    .get(
      "/users/memberships",
      async (context) => {
        const { db, userId } = v1HandlerContext(context);
        const items = await listMembershipsForUser(db, userId);
        return { items };
      },
      {
        response: {
          200: userMembershipsResponse,
        },
      },
    )
    .post(
      "/users/profile/email",
      async (context) => {
        const { db, userId, body } = v1HandlerContext<{ email: string }>(context);

        return updateUserEmailById(db, userId, body.email);
      },
      {
        body: updateEmailBody,
        response: {
          200: userProfileResponse,
        },
      },
    );
}
