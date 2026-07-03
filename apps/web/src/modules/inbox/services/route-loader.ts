import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { readInboxArticleOpenBehaviorCookie } from "../lib/layout-persistence";
import { getInboxPreferences } from "./preferences";

export const getInboxLoaderData = createServerFn({ method: "GET" }).handler(async () => {
  const cookieHeader = getRequestHeaders().get("cookie");
  const initialInboxPreferences = await getInboxPreferences();
  const cookieArticleOpenBehavior = readInboxArticleOpenBehaviorCookie(cookieHeader);

  return {
    initialInboxPreferences: cookieArticleOpenBehavior
      ? {
          ...initialInboxPreferences,
          articleOpenBehavior: cookieArticleOpenBehavior,
        }
      : initialInboxPreferences,
  };
});
