import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { withStatusPage } from "@lib/status-page";

export default createServerEntry({
  fetch: withStatusPage(handler.fetch),
});
