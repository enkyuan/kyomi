/** Whether the pathname is the inbox route (trailing slashes ignored). */
export function isInboxPathname(pathname: string): boolean {
  return pathname.replace(/\/+$/, "") === "/inbox";
}
