import { z } from "zod";

/**
 * Fetch JSON from the API and validate against a Zod schema. Throws a
 * descriptive error if the response doesn't match, catching API contract
 * drift before it reaches the UI.
 */
export async function fetchValidatedJson<T>(
  schema: z.ZodType<T>,
  fetchFn: () => Promise<unknown>,
): Promise<T> {
  const raw = await fetchFn();
  const result = schema.safeParse(raw);
  if (!result.success) {
    console.error("[api-schema] Response validation failed:", result.error.issues);
    throw new Error(
      `API response validation failed: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
    );
  }
  return result.data;
}
