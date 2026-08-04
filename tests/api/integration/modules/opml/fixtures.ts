export function buildOpml(feedCount: number, options?: { depth?: number }): string {
  const outlines = Array.from({ length: feedCount }, (_, index) => {
    const url = "https://example.com/Feed/" + index + "?Key=Value";
    return '<outline text="Feed ' + index + '" xmlUrl="' + url + '"/>';
  }).join("");
  const depth = options?.depth ?? 0;
  const open = Array.from(
    { length: depth },
    (_, index) => '<outline text="Folder ' + index + '">',
  ).join("");
  const close = "</outline>".repeat(depth);
  return (
    '<?xml version="1.0"?><opml version="2.0"><body>' + open + outlines + close + "</body></opml>"
  );
}
