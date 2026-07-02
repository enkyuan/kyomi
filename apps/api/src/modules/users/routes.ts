import type { Elysia } from "elysia";
import { AppError } from "@shared/errors/app";
import { v1HandlerContext } from "@shared/http/v1/context";
import { listMembershipsForUser } from "./organizations/service";
import { userMembershipsResponse } from "./organizations/schemas";
import { updateEmailBody, userProfileResponse } from "./profile/schemas";
import { updateUserPreferencesBody, userPreferencesResponse } from "./preferences/schemas";
import {
  getUserPreferences,
  getUserProfileById,
  updateUserEmailById,
  updateUserPreferences,
} from "./service";

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
          contentWidth?: "narrow" | "wide";
          openLinksInNewTab?: boolean;
          showLinkPreviews?: boolean;
          showImages?: boolean;
          inboxDefaultView?: "my-feed" | "all" | "saved" | "recent";
          inboxDensity?: "comfortable" | "compact";
          articleOpenBehavior?: "split" | "reader";
          inboxMarkReadBehavior?: "on-open" | "after-delay" | "manual";
          inboxTimestampDisplay?: "absolute" | "relative";
          inboxTimestampHourCycle?: "12h" | "24h";
          inboxFontSizePx?: number;
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
