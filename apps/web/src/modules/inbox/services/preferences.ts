import { inboxPreferencesSchema, type InboxPreferencesDto } from "src/lib/schemas";
import { getUserPreferences, updateUserPreferences } from "@modules/preferences/api";

export async function getInboxPreferences(): Promise<InboxPreferencesDto> {
  return inboxPreferencesSchema.parse(await getUserPreferences());
}

export async function updateInboxPreferences({
  data,
}: {
  data: Partial<InboxPreferencesDto>;
}): Promise<InboxPreferencesDto> {
  return inboxPreferencesSchema.parse(await updateUserPreferences({ data }));
}
