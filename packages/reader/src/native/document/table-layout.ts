const MIN_COLUMN = 72;
const MAX_COLUMN = 240;
const CELL_PADDING = 20;
/** Longest run of characters a column is sized for before it is allowed to wrap. */
const MAX_CHARS = 28;

export type TableCellSpec = { readonly span: number; readonly chars: number };

/**
 * Column widths for a table: each column is sized to its longest cell (clamped), then, when the
 * natural total is narrower than the container, scaled up so the table fills it edge to edge.
 * A wider table keeps its natural widths and scrolls. Spanning cells are ignored for sizing.
 */
export function tableColumnWidths(
  rows: readonly (readonly TableCellSpec[])[],
  options: { readonly available: number; readonly charWidth: number },
): number[] {
  const count = Math.max(0, ...rows.map((row) => row.reduce((sum, cell) => sum + cell.span, 0)));
  if (count === 0) return [];
  const longest = new Array<number>(count).fill(0);
  for (const row of rows) {
    let column = 0;
    for (const cell of row) {
      if (cell.span === 1) longest[column] = Math.max(longest[column] ?? 0, cell.chars);
      column += cell.span;
    }
  }
  const natural = longest.map((chars) =>
    Math.min(
      MAX_COLUMN,
      Math.max(MIN_COLUMN, Math.min(chars, MAX_CHARS) * options.charWidth + CELL_PADDING),
    ),
  );
  const total = natural.reduce((sum, width) => sum + width, 0);
  if (total >= options.available) return natural;
  const scale = options.available / total;
  const widths = natural.map((width) => Math.floor(width * scale));
  const used = widths.reduce((sum, width) => sum + width, 0);
  widths[count - 1] = (widths[count - 1] ?? 0) + (options.available - used);
  return widths;
}
