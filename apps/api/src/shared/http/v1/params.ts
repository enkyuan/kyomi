import { t } from "elysia";

export const uuidParam = t.String({ format: "uuid" });

export const taskIdParam = t.String({ minLength: 1 });
