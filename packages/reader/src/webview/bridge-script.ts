export function getReaderWebViewBridgeScript() {
  return `
    (function () {
      window.__VOLS_RSS_READER_READY__ = true;
      document.addEventListener("click", function (event) {
        const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
        if (!target) return;
        target.setAttribute("rel", "noopener noreferrer");
      });
    })();
  `;
}
