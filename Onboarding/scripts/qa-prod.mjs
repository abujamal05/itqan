/**
 * Production QA sweep. Audits the live marketing site across engines and the
 * ten required viewports for: horizontal overflow, container spills, console
 * errors, failed network requests, missing images/icons, undersized tap
 * targets, and broken internal links.
 *
 * Usage: node scripts/qa-prod.mjs   (BASE overridable via QA_BASE)
 */
import { chromium, webkit, devices } from 'playwright-core';

const BASE = (process.env.QA_BASE ?? 'https://itqan-site.vercel.app').replace(/\/$/, '');
const VIEWPORTS = [320, 375, 390, 414, 768, 820, 1024, 1280, 1440, 1920];
const PATHS = [
  '/en/', '/en/how-it-works/', '/en/proof/', '/en/privacy/', '/en/terms/',
  '/en/login/', '/en/signup/', '/en/forgot-password/',
  '/ar/', '/ar/how-it-works/', '/ar/proof/', '/ar/privacy/', '/ar/terms/',
  '/ar/login/', '/ar/signup/', '/ar/forgot-password/',
];

const findings = [];
const add = (f) => findings.push(f);

const PROBE = () => {
  const de = document.documentElement;
  const root = de.getBoundingClientRect();
  const sel = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (typeof el.className === 'string' && el.className.trim())
      s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    return s;
  };
  const clipped = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') return true;
    }
    return false;
  };
  const out = { hScroll: de.scrollWidth - de.clientWidth, spill: [], target: [], img: [] };
  document.querySelectorAll('body *').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    if (cs.position !== 'fixed' && (r.right > root.right + 1 || r.left < root.left - 1) && !clipped(el))
      out.spill.push(sel(el));
    if (/^(a|button|summary|select|input)$/.test(el.tagName.toLowerCase()) && el.type !== 'checkbox'
        && cs.display !== 'inline' && (r.height < 43.5 || r.width < 23.5))
      out.target.push(sel(el) + `(${Math.round(r.width)}x${Math.round(r.height)})`);
    if (el.tagName === 'IMG' && (el.naturalWidth === 0 || !el.complete))
      out.img.push(el.getAttribute('src') || '(no src)');
  });
  out.spill = [...new Set(out.spill)];
  out.target = [...new Set(out.target)];
  out.img = [...new Set(out.img)];
  return out;
};

async function auditEngine(name, browserType, deviceViewports) {
  const browser = await browserType.launch();
  for (const path of PATHS) {
    for (const width of deviceViewports) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      const consoleErrs = [];
      const netFails = [];
      page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 160)); });
      page.on('requestfailed', (r) => netFails.push(`${r.url().slice(0, 80)} (${r.failure()?.errorText})`));
      page.on('response', (r) => { if (r.status() >= 400) netFails.push(`${r.status()} ${r.url().slice(0, 80)}`); });
      try {
        await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 25000 });
        const p = await page.evaluate(PROBE);
        if (p.hScroll > 1) add({ engine: name, path, width, kind: 'overflow', detail: `+${p.hScroll}px` });
        if (p.spill.length) add({ engine: name, path, width, kind: 'spill', detail: p.spill.join(', ') });
        if (p.target.length) add({ engine: name, path, width, kind: 'tap-target', detail: p.target.join(', ') });
        if (p.img.length) add({ engine: name, path, width, kind: 'missing-img', detail: p.img.join(', ') });
        if (consoleErrs.length) add({ engine: name, path, width, kind: 'console', detail: [...new Set(consoleErrs)].join(' | ') });
        if (netFails.length) add({ engine: name, path, width, kind: 'network', detail: [...new Set(netFails)].join(' | ') });
      } catch (e) {
        add({ engine: name, path, width, kind: 'load-error', detail: String(e).slice(0, 120) });
      }
      await ctx.close();
    }
  }
  await browser.close();
}

/** Collect internal links from the two homepages and check each once. */
async function checkLinks() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const links = new Set();
  for (const home of ['/en/', '/ar/']) {
    await page.goto(BASE + home, { waitUntil: 'domcontentloaded' });
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')));
    hrefs.forEach((h) => { if (h && !h.startsWith('http') && !h.startsWith('#') && !h.startsWith('mailto')) links.add(h); });
  }
  for (const href of links) {
    const url = href.startsWith('/') ? BASE + href : `${BASE}/${href}`;
    try {
      const res = await page.request.get(url);
      if (res.status() >= 400) add({ engine: 'links', path: href, width: 0, kind: 'broken-link', detail: `HTTP ${res.status()}` });
    } catch (e) { add({ engine: 'links', path: href, width: 0, kind: 'broken-link', detail: String(e).slice(0, 80) }); }
  }
  await browser.close();
}

console.log(`QA sweep: ${BASE}\nPages: ${PATHS.length} | Viewports: ${VIEWPORTS.join(',')}\n`);
await auditEngine('chromium', chromium, VIEWPORTS);
await auditEngine('webkit', webkit, [320, 375, 390, 414, 768, 820, 1024]); // Safari/iOS-relevant widths
await checkLinks();

if (!findings.length) {
  console.log('No issues found across all pages, engines and viewports.');
} else {
  console.log(`\n=== ${findings.length} FINDINGS ===`);
  const byKind = {};
  for (const f of findings) (byKind[f.kind] ??= []).push(f);
  for (const [kind, list] of Object.entries(byKind)) {
    console.log(`\n## ${kind} (${list.length})`);
    // Collapse identical detail across viewports.
    const seen = new Map();
    for (const f of list) {
      const key = `${f.engine}|${f.path}|${f.detail}`;
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(f.width);
    }
    for (const [key, widths] of seen) {
      const [engine, path, detail] = key.split('|');
      console.log(`  [${engine}] ${path} @${[...new Set(widths)].join(',')} — ${detail}`);
    }
  }
}
