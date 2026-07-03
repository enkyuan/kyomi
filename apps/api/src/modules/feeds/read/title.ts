/** Resolved list/detail title: non-empty custom override wins, else global feed title. */
export function displayFeedTitle(
  globalTitle: string,
  customTitle: string | null | undefined,
): string {
  if (customTitle === null || customTitle === undefined) {
    return globalTitle;
  }
  const trimmed = customTitle.trim();
  return trimmed.length > 0 ? trimmed : globalTitle;
}
