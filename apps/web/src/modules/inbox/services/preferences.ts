import { inboxPreferencesSchema, type InboxPreferencesDto } from "@lib/api-schemas";
import { getUserPreferences, updateUserPreferences } from "@modules/preferences/services/api";

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
