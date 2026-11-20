/** Slash commands of the rail's command menu: `/feeds term` searches the feeds you follow, and so on. */
export const RECAP_SLASH_COMMANDS = [
  { name: "feeds", description: "Search the feeds you follow" },
  { name: "articles", description: "Search articles" },
  { name: "folders", description: "Open a folder" },
] as const;

export type RecapSlashCommand = (typeof RECAP_SLASH_COMMANDS)[number]["name"];

export type RecapPaletteQuery =
  | { kind: "empty" }
  /** `/` or a partial command name: suggest the commands that match. */
  | { kind: "commands"; partial: string }
  /** A complete command, a space, then what to look for. */
  | { kind: "command"; command: RecapSlashCommand; term: string }
  | { kind: "text"; term: string };

const COMMAND_NAMES = new Set<string>(RECAP_SLASH_COMMANDS.map((command) => command.name));

export function parseRecapPaletteQuery(query: string): RecapPaletteQuery {
  const text = query.trimStart();
  if (text.trim() === "") {
    return { kind: "empty" };
  }
  if (!text.startsWith("/")) {
    return { kind: "text", term: text.trim() };
  }

  const body = text.slice(1);
  const space = body.search(/\s/);
  if (space === -1) {
    return { kind: "commands", partial: body.toLowerCase() };
  }

  const name = body.slice(0, space).toLowerCase();
  return COMMAND_NAMES.has(name)
    ? { kind: "command", command: name as RecapSlashCommand, term: body.slice(space).trim() }
    : { kind: "text", term: text.trim() };
}

export function matchesRecapTerm(value: string | null | undefined, term: string): boolean {
  return term === "" || (value ?? "").toLowerCase().includes(term.toLowerCase());
}
