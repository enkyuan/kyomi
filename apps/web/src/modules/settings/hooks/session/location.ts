import type { SessionRow } from "./types";

export function describeSessionLocation(session: Pick<SessionRow, "locationLabel" | "ipAddress">) {
  if (session.locationLabel) {
    return session.locationLabel;
  }

  if (session.ipAddress === "127.0.0.1" || session.ipAddress === "::1") {
    return "Localhost";
  }

  return "Unknown";
}
