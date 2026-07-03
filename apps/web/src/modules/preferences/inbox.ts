import { getUserPreferences, updateUserPreferences } from "@modules/preferences/api";
import { sanitizeInboxPreferences, type InboxPreferences } from "@modules/inbox/lib/preferences";

export async function getInboxPreferences(): Promise<InboxPreferences> {
  return sanitizeInboxPreferences(await getUserPreferences());
}

export async function updateInboxPreferences({
  data,
}: {
  data: Partial<InboxPreferences>;
}): Promise<InboxPreferences> {
  return sanitizeInboxPreferences(await updateUserPreferences({ data }));
}
