import { z } from "zod";

export const authSessionListRowSchema = z.object({
  id: z.string(),
  token: z.string(),
  ipAddress: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  userAgent: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  updatedAt: z.string(),
  expiresAt: z.string(),
  locationLabel: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  locationCity: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  locationRegion: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  locationCountry: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

export const authSessionListSchema = z.array(authSessionListRowSchema);
