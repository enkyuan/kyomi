import { readerPreferencesSchema, type ReaderPreferencesDto } from "src/lib/schemas";
import { getUserPreferences, updateUserPreferences } from "@modules/preferences/api";

export async function getReaderPreferences(): Promise<ReaderPreferencesDto> {
  return readerPreferencesSchema.parse(await getUserPreferences());
}

export async function updateReaderPreferences({
  data,
}: {
  data: Partial<ReaderPreferencesDto>;
}): Promise<ReaderPreferencesDto> {
  return readerPreferencesSchema.parse(await updateUserPreferences({ data }));
}
