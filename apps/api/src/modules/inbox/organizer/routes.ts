import type { Elysia } from "elysia";
import { v1HandlerContext } from "@shared/http/v1/context";
import {
  inboxOrganizerQuerySchema,
  inboxOrganizerResponseSchema,
} from "./schemas";
import { getInboxOrganizer } from "./service";

export function registerInboxOrganizerRoutes(app: Elysia) {
  return app.get(
    "/inbox/organizer",
    async (context) => {
      const { db, query, userId } = v1HandlerContext<
        unknown,
        { limit?: string }
      >(context);
      return getInboxOrganizer(db, userId, query.limit);
    },
    {
      query: inboxOrganizerQuerySchema,
      response: { 200: inboxOrganizerResponseSchema },
    },
  );
}
