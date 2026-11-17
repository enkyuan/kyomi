import type { Elysia } from "elysia";
import type { ManagedRuntime } from "effect";
import type { Db } from "@adapters/db/service";
import { runEffect } from "@shared/http/effect/bridge";
import { v1EffectContext } from "@shared/http/v1/context";
import { listMemberships } from "./organizations/memberships";
import { userMembershipsResponse } from "./organizations/schemas";
import { getUserProfile, updateUserEmail } from "./profile/account";
import { updateEmailBody, userProfileResponse } from "./profile/schemas";
import { getUserPreferences, updateUserPreferences } from "./preferences/settings";
import { updateUserPreferencesBody, userPreferencesResponse } from "./preferences/schemas";
import type { UpdateUserPreferencesDto } from "./preferences/types";

type UserRuntime = ManagedRuntime.ManagedRuntime<Db, unknown>;

export function registerUserRoutes(app: Elysia, runtime: UserRuntime) {
  return app
    .get(
      "/me/preferences",
      (context) => {
        const { request, requestId, userId } = v1EffectContext(context);
        return runEffect({ runtime, request, requestId, userId }, getUserPreferences);
      },
      { response: { 200: userPreferencesResponse } },
    )
    .patch(
      "/me/preferences",
      (context) => {
        const { body, request, requestId, userId } =
          v1EffectContext<UpdateUserPreferencesDto>(context);
        return runEffect({ runtime, request, requestId, userId }, updateUserPreferences(body));
      },
      {
        body: updateUserPreferencesBody,
        response: { 200: userPreferencesResponse },
      },
    )
    .get(
      "/users/profile",
      (context) => {
        const { request, requestId, userId } = v1EffectContext(context);
        return runEffect({ runtime, request, requestId, userId }, getUserProfile);
      },
      { response: { 200: userProfileResponse } },
    )
    .get(
      "/users/memberships",
      async (context) => {
        const { request, requestId, userId } = v1EffectContext(context);
        const items = await runEffect({ runtime, request, requestId, userId }, listMemberships);
        return { items };
      },
      { response: { 200: userMembershipsResponse } },
    )
    .post(
      "/users/profile/email",
      (context) => {
        const { body, request, requestId, userId } = v1EffectContext<{ email: string }>(context);
        return runEffect({ runtime, request, requestId, userId }, updateUserEmail(body.email));
      },
      {
        body: updateEmailBody,
        response: { 200: userProfileResponse },
      },
    );
}
