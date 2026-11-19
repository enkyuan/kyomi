import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { withServerTiming } from "@lib/server-timing";
import { withStatusPage } from "@lib/status-page";

export default createServerEntry({
  fetch: withServerTiming(withStatusPage(handler.fetch)),
});
