import { getUserPreferences, updateUserPreferences } from "@modules/preferences/api";
import { sanitizeReaderPreferences, type ReaderPreferences } from "../lib/preferences";

export async function getReaderPreferences(): Promise<ReaderPreferences> {
  return sanitizeReaderPreferences(await getUserPreferences());
}

export async function updateReaderPreferences({
  data,
}: {
  data: Partial<ReaderPreferences>;
}): Promise<ReaderPreferences> {
  return sanitizeReaderPreferences(await updateUserPreferences({ data }));
}
