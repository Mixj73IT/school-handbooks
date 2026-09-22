'use strict';

// Content store: plain markdown files on disk.
//
//   data/years/<yearId>/handbooks/<handbookId>/<order>-<pageId>.md
//   data/years/<yearId>/settings.json
//
// Page files start with a small front-matter block:
//
//   ---
//   title: Attendance Policy
//   slug: attendance-policy
//   ---
//   markdown body...
//
// Slug is globally unique within a year and becomes the public URL, so links in
// emails/print stay stable. `order` (N0000-) controls TOC position and renames
// are cheap because the id lives after the dash.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { YEARS_DIR, EXPORT_DIR } = require('../config');

// Change listeners: the search index subscribes so it can rebuild when content
// changes. (Requiring search.js here would create a circular dependency.)
const changeListeners = new Set();
function onContentChanged(fn) {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}
function notifyChanged() {
  for (const fn of changeListeners) {
    try {
      fn();
    } catch {
      // A listener must never break a content write.
    }
  }
}

const HANDBOOKS = {
  'parent-student': { id: 'parent-student', name: 'Parent & Student Handbook', emoji: '🎒', order: 1 },
  employee: { id: 'employee', name: 'Employee Handbook', emoji: '🧑‍🏫', order: 2 },
  athletics: { id: 'athletics', name: 'Athletics Handbook', emoji: '⚽', order: 3 },
};

const settingsFile = (yearId) => path.join(YEARS_DIR, yearId, 'settings.json');
const handbooksDir = (yearId) => path.join(YEARS_DIR, yearId, 'handbooks');

// ---------------------------------------------------------------- years ----

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'page';
}

function yearSettingsPath(yearId) {
  return settingsFile(yearId);
}

function readSettings(yearId) {
  const fallback = { yearId, title: yearId, published: true, archived: false };
  try {
    return { ...fallback, ...JSON.parse(fs.readFileSync(settingsFile(yearId), 'utf8')) };
  } catch {
    return fallback;
  }
}

function writeSettings(yearId, settings) {
  fs.mkdirSync(path.join(YEARS_DIR, yearId), { recursive: true });
  fs.writeFileSync(settingsFile(yearId), JSON.stringify(settings, null, 2));
}

function currentYearId() {
  const now = new Date();
  const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

function listYears() {
  if (!fs.existsSync(YEARS_DIR)) return [];
  const years = fs
    .readdirSync(YEARS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => readSettings(d.name));
  // Newest school year first for admin pickers.
  return years.sort((a, b) => b.yearId.localeCompare(a.yearId));
}

function yearExists(yearId) {
  return !!yearId && fs.existsSync(path.join(YEARS_DIR, yearId, 'settings.json'));
}

function getYear(yearId) {
  return yearExists(yearId) ? readSettings(yearId) : null;
}

function createYear(yearId, title) {
  if (!/^\d{4}-\d{4}$/.test(yearId)) throw new Error('Year id must look like 2026-2027');
  if (yearExists(yearId)) throw new Error('That school year already exists');
  writeSettings(yearId, {
    yearId,
    title: String(title || `${yearId} School Year`),
    published: true,
    archived: false,
  });
  return getYear(yearId);
}

function updateYear(yearId, { title, published, archived }) {
  const settings = getYear(yearId);
  if (!settings) throw new Error('School year not found');
  if (title !== undefined) settings.title = String(title).trim() || settings.title;
  if (published !== undefined) settings.published = !!published;
  if (archived !== undefined) settings.archived = !!archived;
  writeSettings(yearId, settings);
  notifyChanged();
  return settings;
}

function deleteYear(yearId) {
  if (!yearExists(yearId)) throw new Error('School year not found');
  fs.rmSync(path.join(YEARS_DIR, yearId), { recursive: true, force: true });
  notifyChanged();
}

// Duplicate an entire year (all handbooks + pages) into a new school year,
// unpublishing the copy so it can be worked on before going live.
function duplicateYear(sourceYearId, newYearId, newTitle) {
  if (yearExists(newYearId)) throw new Error('That school year already exists');
  createYear(newYearId, newTitle || `${newYearId} School Year`);
  const src = path.join(YEARS_DIR, sourceYearId, 'handbooks');
  const dst = path.join(YEARS_DIR, newYearId, 'handbooks');
  if (fs.existsSync(src)) {
    fs.mkdirSync(dst, { recursive: true });
    fs.cpSync(src, dst, { recursive: true });
  }
  updateYear(newYearId, { published: false });
  return getYear(newYearId);
}

// ------------------------------------------------------------- pages -----

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseFrontMatter(raw) {
  const match = raw.match(FRONT_MATTER_RE);
  if (!match) return { meta: {}, body: raw };
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) meta[key] = value;
  }
  return { meta, body: raw.slice(match[0].length) };
}

function serializePage(page) {
  return `---\ntitle: ${page.title}\nslug: ${page.slug}\n---\n${page.body}`;
}

function pageFilename(order, id) {
  return `${String(order).padStart(4, '0')}-${id}.md`;
}

function pageIdFromFilename(filename) {
  const m = filename.match(/^\d+-([0-9a-f-]+)\.md$/);
  return m ? m[1] : null;
}

function orderFromFilename(filename) {
  const m = filename.match(/^(\d+)-/);
  return m ? parseInt(m[1], 10) : 0;
}

function readPageFile(yearId, handbookId, filename) {
  const raw = fs.readFileSync(path.join(handbooksDir(yearId), handbookId, filename), 'utf8');
  const { meta, body } = parseFrontMatter(raw);
  return {
    id: pageIdFromFilename(filename) || crypto.randomUUID(),
    order: orderFromFilename(filename),
    title: meta.title || 'Untitled',
    slug: meta.slug || 'page',
    body,
    handbookId,
    yearId,
    filename,
  };
}

function listPages(yearId, handbookId) {
  const dir = path.join(handbooksDir(yearId), handbookId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => readPageFile(yearId, handbookId, f))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

function getPage(yearId, handbookId, pageId) {
  const dir = path.join(handbooksDir(yearId), handbookId);
  if (!fs.existsSync(dir)) return null;
  const filename = fs
    .readdirSync(dir)
    .find((f) => f.endsWith(`-${pageId}.md`));
  if (!filename) return null;
  return readPageFile(yearId, handbookId, filename);
}

function getPageBySlug(yearId, slug) {
  for (const handbookId of Object.keys(HANDBOOKS)) {
    const page = listPages(yearId, handbookId).find((p) => p.slug === slug);
    if (page) return page;
  }
  return null;
}

function isSlugTaken(yearId, slug, { excludePageId, excludeHandbookId } = {}) {
  for (const handbookId of Object.keys(HANDBOOKS)) {
    for (const p of listPages(yearId, handbookId)) {
      if (p.slug === slug) {
        if (excludePageId && p.id === excludePageId && p.handbookId === excludeHandbookId) continue;
        return true;
      }
    }
  }
  return false;
}

function createPage(yearId, handbookId, { title, slug, body }) {
  if (!HANDBOOKS[handbookId]) throw new Error('Unknown handbook');
  const cleanSlug = slugify(slug || title);
  if (isSlugTaken(yearId, cleanSlug)) throw new Error('That URL slug is already used by another page this year');
  const pages = listPages(yearId, handbookId);
  const order = (pages.at(-1)?.order || 0) + 1;
  const page = {
    id: crypto.randomUUID(),
    order,
    title: String(title || 'Untitled').trim() || 'Untitled',
    slug: cleanSlug,
    body: String(body || ''),
  };
  const dir = path.join(handbooksDir(yearId), handbookId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, pageFilename(order, page.id)), serializePage(page));
  notifyChanged();
  return page;
}

function updatePage(yearId, handbookId, pageId, { title, slug, body, order }) {
  const existing = getPage(yearId, handbookId, pageId);
  if (!existing) throw new Error('Page not found');

  const page = { ...existing };
  if (title !== undefined) page.title = String(title).trim() || 'Untitled';
  if (body !== undefined) page.body = String(body);

  if (slug !== undefined && slug !== existing.slug) {
    const cleanSlug = slugify(slug);
    if (isSlugTaken(yearId, cleanSlug, { excludePageId: pageId, excludeHandbookId: handbookId })) {
      throw new Error('That URL slug is already used by another page this year');
    }
    page.slug = cleanSlug;
  }
  if (order !== undefined) page.order = Math.max(1, parseInt(order, 10) || existing.order);

  const dir = path.join(handbooksDir(yearId), handbookId);
  const newFilename = pageFilename(page.order, page.id);
  if (newFilename !== existing.filename) {
    fs.rmSync(path.join(dir, existing.filename), { force: true });
  }
  fs.writeFileSync(path.join(dir, newFilename), serializePage(page));
  notifyChanged();
  return page;
}

function deletePage(yearId, handbookId, pageId) {
  const existing = getPage(yearId, handbookId, pageId);
  if (!existing) throw new Error('Page not found');
  fs.rmSync(path.join(handbooksDir(yearId), handbookId, existing.filename), { force: true });
  notifyChanged();
}

// Move a page up or down within its handbook TOC.
function movePage(yearId, handbookId, pageId, direction) {
  const pages = listPages(yearId, handbookId);
  const idx = pages.findIndex((p) => p.id === pageId);
  if (idx === -1) throw new Error('Page not found');
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= pages.length) return;
  const a = pages[idx];
  const b = pages[swapWith];
  updatePage(yearId, handbookId, a.id, { order: b.order });
  updatePage(yearId, handbookId, b.id, { order: a.order });
}

// ------------------------------------------------------------- export ----

// Export a whole year as one self-contained HTML file (print-to-PDF ready:
// includes the stylesheet inline and page-break hints between sections).
function exportYearToHtml(yearId) {
  const year = getYear(yearId);
  const marked = require('marked');
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'site.css'), 'utf8');
  const sections = [];

  for (const [handbookId, handbook] of Object.entries(HANDBOOKS)) {
    const pages = listPages(yearId, handbookId);
    if (!pages.length) continue;
    const items = pages
      .map((p) => `<li><a href="#${p.slug}">${escapeHtml(p.title)}</a></li>`)
      .join('\n');
    const body = pages
      .map(
        (p) =>
          `<section class="handbook-page export-page" id="${p.slug}">\n<h1>${escapeHtml(
            p.title
          )}</h1>\n${marked.parse(p.body)}\n</section>`
      )
      .join('\n');
    sections.push(
      `<section class="export-handbook"><h2 class="handbook-heading">${handbook.emoji} ${escapeHtml(
        handbook.name
      )}</h2>\n<ul class="export-toc">${items}</ul>\n${body}\n</section>`
    );
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(year ? year.title : yearId)} — ${escapeHtml('Handbooks')}</title>
<style>${css}
.export-toc { columns: 2; }
.export-page { page-break-before: always; border: none; box-shadow: none; padding: 0; }
.handbook-heading { border: none; }
@media print { .no-print { display: none; } }
</style>
</head>
<body>
<div class="container">
<h1>${escapeHtml(year ? year.title : yearId)} Handbooks</h1>
${sections.join('\n')}
</div>
</body>
</html>`;
}

function exportYearToFile(yearId) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  const out = path.join(EXPORT_DIR, `${yearId}-handbooks.html`);
  fs.writeFileSync(out, exportYearToHtml(yearId));
  return out;
}

// Add stable ids to h2/h3 in rendered markdown and return a mini table of
// contents, so long pages get a clickable "on this page" outline.
function withHeadingAnchors(html) {
  const toc = [];
  const used = new Set();
  const out = String(html).replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (m, level, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    if (!text) return m;
    let id = slugify(text);
    let n = 2;
    while (used.has(id)) id = `${slugify(text)}-${n++}`;
    used.add(id);
    toc.push({ id, text, level: Number(level) });
    return `<h${level} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${inner}</h${level}>`;
  });
  return { html: out, toc };
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

module.exports = {
  HANDBOOKS,
  slugify,
  listYears,
  yearExists,
  getYear,
  createYear,
  updateYear,
  deleteYear,
  duplicateYear,
  currentYearId,
  listPages,
  getPage,
  getPageBySlug,
  createPage,
  updatePage,
  deletePage,
  movePage,
  isSlugTaken,
  withHeadingAnchors,
  onContentChanged,
  exportYearToHtml,
  exportYearToFile,
  escapeHtml,
};
