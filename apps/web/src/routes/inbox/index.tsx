import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAuth } from "@/routes/-guards";
import { InboxPage } from "@pages/inbox/";

const inboxSearchSchema = z.object({
  filter: z.enum(["today", "unread", "saved"]).optional(),
  search: z.string().optional(),
  itemId: z.string().optional(),
});

export const Route = createFileRoute("/inbox/")({
  beforeLoad: async () => {
    await requireAuth();
  },
  validateSearch: (search) => inboxSearchSchema.parse(search),
  component: InboxPage,
});
