'use strict';

// Responsive audit: drives the system Chrome/Edge (headless) via
// puppeteer-core, loads every key page at phone/tablet/desktop widths, and
// reports horizontal overflow plus offending elements.
//
//   node scripts/responsive-audit.js [baseUrl]
//   AUDIT_ADMIN_PASS=... node scripts/responsive-audit.js   # also audit admin
//
// Exit code 1 when any layout problem is found, so it can gate CI later.
// Failing combinations are screenshotted into the OS temp dir.

const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer-core');

const WIDTHS = [360, 414, 600, 768, 1024, 1280];

const PUBLIC_PAGES = [
  { path: '/', name: 'home' },
  { path: '/handbook/parent-student/attendance', name: 'handbook-page' },
  { path: '/handbook/employee/leave', name: 'employee-page' },
  { path: '/handbook/athletics/eligibility', name: 'athletics-page' },
  { path: '/search?q=concussion', name: 'search-results' },
  { path: '/search', name: 'search-empty' },
  { path: '/auth/login', name: 'login' },
];

const BROWSER_CANDIDATES = [
  process.env.BROWSER_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') : null,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
].filter(Boolean);

function findBrowser() {
  return BROWSER_CANDIDATES.find((p) => fs.existsSync(p)) || null;
}

// In-page measurement: overflow, who causes it, and whether the handbook
// sidebar is pinned over the article (the bug class we already fixed once).
const MEASURE = () => {
  const se = document.scrollingElement;
  const overflowX = Math.max(0, se.scrollWidth - se.clientWidth);
  const offenders = [];
  if (overflowX > 0) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.right > se.clientWidth + 1 && r.width > 4) {
        const cls = String(el.className).split(' ')[0];
        offenders.push(`${el.tagName.toLowerCase()}.${cls} right=${Math.round(r.right)} w=${Math.round(r.width)}`);
        if (offenders.length >= 5) break;
      }
    }
  }
  let sidebarOverContent = false;
  const sb = document.querySelector('.toc-sidebar');
  const art = document.querySelector('.handbook-page');
  if (sb && art && getComputedStyle(sb).position === 'sticky') {
    const sr = sb.getBoundingClientRect();
    const ar = art.getBoundingClientRect();
    sidebarOverContent = ar.left < sr.right - 2;
  }
  return { overflowX, offenders, sidebarOverContent };
};

async function auditOne(browser, base, { path: pagePath, name }, width, adminCookie) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 820 });
  // Audit the real logged-out login page; everything else uses the session.
  if (adminCookie && name !== 'login') {
    await page.setCookie(...adminCookie);
  }
  try {
    await page.goto(base + pagePath, { waitUntil: 'networkidle0', timeout: 20000 });
  } catch {
    await page.goto(base + pagePath, { waitUntil: 'load', timeout: 20000 });
  }
  const result = await page.evaluate(MEASURE);
  if (result.overflowX > 0 || result.sidebarOverContent) {
    const shot = path.join(os.tmpdir(), `audit-${name}-${width}.png`);
    await page.screenshot({ path: shot });
    result.screenshot = shot;
  }
  await page.close();
  return result;
}

async function getAdminCookie(browser, base) {
  const password = process.env.AUDIT_ADMIN_PASS;
  if (!password) return null;
  const page = await browser.newPage();
  await page.goto(base + '/auth/login', { waitUntil: 'networkidle0' });
  await page.type('#username', 'admin');
  await page.type('#password', password);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type=submit]')]);
  const cookies = await page.cookies();
  await page.close();
  return cookies;
}

async function main() {
  const port = parseInt(process.env.PORT, 10) || 4321;
  const base = process.argv[2] || `http://127.0.0.1:${port}`;
  const exe = findBrowser();
  if (!exe) {
    console.error('No Chrome/Edge found. Install one or set BROWSER_PATH.');
    process.exit(2);
  }

  const browser = await puppeteer.launch({
    executablePath: exe,
    headless: 'new',
    args: ['--disable-gpu', '--no-first-run', '--hide-scrollbars'],
  });

  const adminCookie = await getAdminCookie(browser, base);
  const pages = [...PUBLIC_PAGES];
  if (adminCookie) {
    pages.push(
      { path: '/admin', name: 'admin-dashboard' },
      { path: '/admin/pages/parent-student', name: 'admin-pages' },
      { path: '/admin/pages/parent-student/new', name: 'admin-editor' }
    );
  }

  const problems = [];
  for (const width of WIDTHS) {
    for (const spec of pages) {
      const r = await auditOne(browser, base, spec, width, adminCookie);
      const bad = r.overflowX > 0 || r.sidebarOverContent;
      const label = `${spec.name} @ ${width}px`;
      if (bad) {
        problems.push({ label, ...r });
        console.log(`✖ ${label}: overflowX=${r.overflowX}px sidebarOverContent=${r.sidebarOverContent}`);
        if (r.offenders.length) console.log(`    ${r.offenders.join(' | ')}`);
        if (r.screenshot) console.log(`    screenshot: ${r.screenshot}`);
      } else {
        console.log(`✔ ${label}`);
      }
    }
  }

  await browser.close();
  console.log(`\n${problems.length} problem${problems.length === 1 ? '' : 's'} found across ${WIDTHS.length * pages.length} checks.`);
  process.exit(problems.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
