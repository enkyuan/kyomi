const CLIENT_CAROUSEL_CLASS_RE =
  /carousel|slider|slick|swiper|glide|dots?|indicator|pagination|pager|nav-thumb|slideshow|owl/i;

function isClientDotOrBullet(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (
    /^[\u2022\u25CF\u25CB\u25E6\u25FC\u25FB\u25A0\u25A1\u25AA\u25AB\u2013\u2014\u00B7\u2023\u2B24]$/.test(
      t,
    )
  )
    return true;
  if (/^\d{1,3}$/.test(t)) return true;
  return false;
}

export function stripClientCarouselArtifacts(container: HTMLElement): void {
  for (const list of [...container.querySelectorAll<HTMLElement>("ul, ol")]) {
    const items = list.querySelectorAll(":scope > li");
    if (items.length === 0) {
      list.remove();
      continue;
    }
    const hasCarouselClass = CLIENT_CAROUSEL_CLASS_RE.test(list.className ?? "");
    const allDots = Array.from(items).every((li) => isClientDotOrBullet(li.textContent ?? ""));
    if (list.tagName === "OL" && !hasCarouselClass) continue;
    if (hasCarouselClass || allDots) {
      list.remove();
    }
  }
}
