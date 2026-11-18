import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { withSecurityHeaders } from "@lib/security-headers";
import { withServerTiming } from "@lib/server-timing";
import { withStatusPage } from "@lib/status-page";

export default createServerEntry({
  fetch: withSecurityHeaders(withServerTiming(withStatusPage(handler.fetch))),
});
