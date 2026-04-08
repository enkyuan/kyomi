import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAuth } from "@/routes/-guards";
import { InboxPage } from "@pages/inbox/";

const inboxSearchSchema = z.object({
  source: z.enum(["reddit", "x"]).optional(),
  status: z.enum(["new", "saved", "dismissed", "replied", "converted"]).optional(),
  search: z.string().optional(),
  sort: z.enum(["rank", "recent"]).optional(),
  itemId: z.string().optional(),
});

export const Route = createFileRoute("/inbox/")({
  beforeLoad: async () => {
    await requireAuth();
  },
  validateSearch: (search) => inboxSearchSchema.parse(search),
  component: InboxPage,
});
