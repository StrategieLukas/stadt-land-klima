/** Local-only integration mock: public KlimaLautern chrome, no WordPress scripts. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const sourceUrl = "https://klimalautern.de/";
const directory = fileURLToPath(new URL("../../../.reports/wahlcheck-local-demo/host/klimalautern", import.meta.url));
const target = new URL(process.argv[2] || "http://localhost:8080/embed/wahlcheck/wahlcheck-demo?theme=localzero");
if (
  !["http:", "https:"].includes(target.protocol) ||
  target.username ||
  target.password ||
  !/^\/embed\/wahlcheck\/[a-z0-9-]{1,160}\/?$/.test(target.pathname)
)
  throw new Error("Use a full, credential-free Wahlcheck embed URL");
const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`KlimaLautern source: HTTP ${response.status}`);
const source = await response.text();
const browser = await chromium.launch();
let snapshot;
try {
  const page = await browser.newPage();
  snapshot = await page.evaluate((html) => {
    const document = new DOMParser().parseFromString(html, "text/html");
    // Detached DOM parsing never executes the source site's scripts.
    document.querySelectorAll("script, iframe, object, embed, form").forEach((element) => element.remove());
    document.querySelectorAll("*").forEach((element) => {
      [...element.attributes].forEach((attribute) => {
        if (/^on/i.test(attribute.name) || attribute.name === "data-avia-search-tooltip")
          element.removeAttribute(attribute.name);
      });
    });
    return {
      htmlClass: document.documentElement.className,
      bodyClass: document.body.className,
      styles: [...document.querySelectorAll('link[rel="stylesheet"], style')].map((node) => node.outerHTML).join("\n"),
      header: document.querySelector("#header")?.outerHTML,
      footer: document.querySelector("#footer")?.outerHTML,
      socket: document.querySelector("#socket")?.outerHTML,
    };
  }, source);
} finally {
  await browser.close();
}
if (!snapshot.header || !snapshot.footer || !snapshot.socket) throw new Error("Missing source header or footer");
const example = await readFile(new URL("../../wahlcheck-iframe/index.html", import.meta.url), "utf8");
const start = example.indexOf("const childOrigin = target.origin;");
const end = example.indexOf("frame.src = target.href;", start);
if (start < 0 || end < 0) throw new Error("Maintained iframe controller could not be located");
const controller = example.slice(start, end + "frame.src = target.href;".length);
// Preserve public links and stylesheet-relative asset resolution, but no live forms/scripts.
let chrome =
  snapshot.header +
  `<main id="main"><section class="container_wrap main_color"><div class="container"><div class="content av-content-full alpha units"><iframe id="wahlcheck" title="Klima-Wahlcheck" height="600" allow="clipboard-write; web-share" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer"></iframe></div></div></section>` +
  snapshot.footer +
  snapshot.socket +
  "</main>";
chrome = chrome.replace(/href="\/(?!\/)/g, 'href="https://klimalautern.de/');
const html = `<!doctype html>
<!-- Local integration example. Public header/footer and styling: ${sourceUrl} -->
<html lang="de" class="${snapshot.htmlClass} avia_desktop js_active"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>KlimaLautern – Wahlcheck (lokales Beispiel)</title>
${snapshot.styles}
<style>
#wahlcheck { display:block; width:100%; border:0; margin:0; }
#main .content { border:0; padding-top:32px; padding-bottom:32px; }
#header .av-main-nav li:hover > .sub-menu, #header .av-main-nav li:focus-within > .sub-menu { visibility:visible; opacity:1; }
@media (max-width:767px) {
  #header .av-main-nav.preview-menu-open > li:not(.menu-item-avia-special) { display:block!important; float:none; }
  #header .av-main-nav.preview-menu-open > #menu-item-search { display:none!important; }
  #header .av-main-nav.preview-menu-open { position:absolute; right:0; top:80px; width:260px; background:white; padding:12px; box-shadow:0 3px 10px #0002; }
  #header .av-main-nav.preview-menu-open > li > a { color:#011633; height:auto!important; line-height:2.5!important; }
  #header .av-main-nav.preview-menu-open .av-burger-menu-main { position:absolute; right:0; top:-80px; }
  #main .content { padding-top:16px; padding-bottom:16px; }
}
</style></head><body id="top" class="${snapshot.bodyClass}"><div id="wrap_all">${chrome}</div>
<script type="module">
const frame = document.querySelector('#wahlcheck');
const target = new URL(${JSON.stringify(target.href).replace(/</g, "\\u003c")});
${controller}
const menu = document.querySelector('.av-burger-menu-main a');
menu?.setAttribute('aria-expanded', 'false');
menu?.addEventListener('click', (event) => {
  event.preventDefault();
  const open = document.querySelector('#avia-menu').classList.toggle('preview-menu-open');
  menu.setAttribute('aria-expanded', String(open));
});
</script></body></html>`;
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, "index.html"), html);
console.log(`Prepared ${directory}/index.html\nSource: ${sourceUrl}\nWahlcheck: ${target.href}`);
