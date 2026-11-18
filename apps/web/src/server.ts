import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { withSecurityHeaders } from "@lib/security-headers";
import { withStatusPage } from "@lib/status-page";

export default createServerEntry({
  fetch: withSecurityHeaders(withStatusPage(handler.fetch)),
});
