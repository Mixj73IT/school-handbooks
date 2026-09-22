'use strict';
// Throwaway: captures README screenshots with the local Chrome.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = 'http://127.0.0.1:4321';
const OUT = path.join(__dirname, '..', 'docs', 'screenshots');

function findChrome() {
  const candidates = [
    process.env.BROWSER_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('No Chromium browser found');
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });

  const shot = async (name) => {
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(OUT, name) });
    console.log('saved', name);
  };

  // 1. Public home
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await shot('home.png');

  // 2. Reading view (first page of parent-student handbook)
  await page.goto(BASE + '/handbook/parent-student', { waitUntil: 'networkidle0' });
  await shot('reading.png');

  // 3. Search results
  await page.goto(BASE + '/search?q=attendance', { waitUntil: 'networkidle0' });
  await shot('search.png');

  // 4. Admin editor (log in first)
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle0' });
  await page.type('input[name="username"]', 'admin');
  await page.type('input[name="password"]', process.env.ScreenshotAdminPass);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')]);
  // Open the first page in the editor
  await page.goto(BASE + '/admin', { waitUntil: 'networkidle0' });
  await page.click('.page-title-link');
  await page.waitForSelector('#page-body');
  await shot('editor.png');

  await browser.close();
  console.log('done');
})().catch((err) => { console.error(err); process.exit(1); });
