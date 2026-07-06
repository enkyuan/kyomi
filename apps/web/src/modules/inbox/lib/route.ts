import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { readTimezoneOffsetCookie } from "@lib/timezone";
import { getInboxPreferences } from "@modules/preferences/inbox";
import { readInboxArticleOpenBehaviorCookie } from "./layout/persistence";

export const getInboxLoaderData = createServerFn({ method: "GET" }).handler(async () => {
  const cookieHeader = getRequestHeaders().get("cookie");
  const initialInboxPreferences = await getInboxPreferences();
  const cookieArticleOpenBehavior = readInboxArticleOpenBehaviorCookie(cookieHeader);
  const initialTimezoneOffsetMinutes = readTimezoneOffsetCookie(cookieHeader);

  return {
    initialInboxPreferences: cookieArticleOpenBehavior
      ? {
          ...initialInboxPreferences,
          articleOpenBehavior: cookieArticleOpenBehavior,
        }
      : initialInboxPreferences,
    initialTimezoneOffsetMinutes,
  };
});
