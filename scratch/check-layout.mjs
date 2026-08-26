import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ defaultViewport: { width: 1680, height: 984 } });
const page = await browser.newPage();
await page.goto("http://localhost:3000/inbox?filter=all");
await page.waitForSelector('[data-slot="app-shell-content"]');
const box = await page.evaluate(() => {
  const el = document.querySelector('[data-slot="app-shell-content"]');
  const rect = el.getBoundingClientRect();
  const recap = document.querySelector("aside");
  const recapRect = recap.getBoundingClientRect();
  const sidebar = document.querySelector('[data-slot="sidebar"]');
  const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
  return { shell: rect, recap: recapRect, sidebar: sidebarRect, winWidth: window.innerWidth };
});
console.log(box);
await browser.close();
