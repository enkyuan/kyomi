import { z } from "zod";

export const messageResponseSchema = z.object({
  message: z.string(),
});
