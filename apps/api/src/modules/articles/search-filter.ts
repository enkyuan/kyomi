export const escapeLikePattern = (input: string): string =>
  input.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");

export function searchPattern(search: string | undefined): string | undefined {
  const trimmed = search?.trim();
  return trimmed ? `%${escapeLikePattern(trimmed)}%` : undefined;
}
