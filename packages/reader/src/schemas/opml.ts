import { z } from "zod";

export const opmlImportAcceptedSchema = z.object({
  taskId: z.string(),
});

const opmlImportStatusValueSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
]);

const opmlImportFailureSchema = z.object({
  url: z.string(),
  code: z.string(),
  message: z.string(),
});

const opmlImportSummarySchema = z.object({
  totalUrls: z.number(),
  completed: z.number(),
  subscribed: z.number(),
  alreadySubscribed: z.number(),
  failed: z.number(),
  cancelled: z.number(),
  failures: z.array(opmlImportFailureSchema),
});

export const opmlImportStatusSchema = z.object({
  taskId: z.string(),
  status: opmlImportStatusValueSchema,
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  filename: z.string(),
  opmlTitle: z.string().nullable(),
  opmlAuthor: z.string().nullable(),
  message: z.string().nullable(),
  summary: opmlImportSummarySchema,
});

export type OpmlImportAcceptedDto = z.infer<typeof opmlImportAcceptedSchema>;
export type OpmlImportStatusDto = z.infer<typeof opmlImportStatusSchema>;
