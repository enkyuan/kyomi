import { HttpStatusError } from "@lib/status";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPAQUE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** An article or folder id: the API's route params accept only UUIDs. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/**
 * The id as a UUID, or a 400. A server function turns its input into a request path, and an id such
 * as `../auth/sign-out?` would send the signed-in user's request to a route of the attacker's choice.
 */
export function parseUuid(value: unknown) {
  if (!isUuid(value)) {
    throw new HttpStatusError(400, "That id is not valid.");
  }
  return value;
}

/**
 * An id the API leaves an opaque string (a feed, an import task), as a single plain path segment.
 * `.` and `..` are excluded by the alphabet: a path segment of dots is resolved, not sent.
 */
export function parseOpaqueId(value: unknown) {
  if (typeof value !== "string" || !OPAQUE_ID.test(value)) {
    throw new HttpStatusError(400, "That id is not valid.");
  }
  return value;
}
