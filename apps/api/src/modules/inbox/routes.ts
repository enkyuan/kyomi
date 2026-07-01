import type { Elysia } from "elysia";
import { registerInboxOrganizerRoutes } from "./organizer/routes";

export function registerInboxRoutes(app: Elysia) {
  return registerInboxOrganizerRoutes(app);
}
