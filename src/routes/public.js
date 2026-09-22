'use strict';

const express = require('express');
const config = require('../../config');
const content = require('../content');
const search = require('../search');

const router = express.Router();

// Wrap query-term matches in the excerpt with <mark> so results are scannable.
// The excerpt is escaped first, so the only markup added is our own <mark> tags.
function highlightExcerpt(excerpt, query) {
  const escaped = content.escapeHtml(excerpt);
  const terms = String(query).split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) return escaped;
  const pattern = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return escaped.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
}

function resolveYear(req) {
  // Priority: explicit ?year= → the viewer's sticky choice → newest published year.
  const requested = typeof req.query.year === 'string' ? req.query.year : null;
  if (requested && content.yearExists(requested)) {
    req.session.yearId = requested;
    return content.getYear(requested);
  }
  if (req.session.yearId && content.yearExists(req.session.yearId)) {
    return content.getYear(req.session.yearId);
  }
  const years = content
    .listYears()
    .filter((y) => y.published && !y.archived)
    .sort((a, b) => b.yearId.localeCompare(a.yearId));
  return years[0] || null;
}

router.get('/', (req, res) => {
  const year = resolveYear(req);
  const years = content.listYears().filter((y) => y.published && !y.archived);
  if (!year) {
    return res.render('public/home-empty', { title: 'Welcome' });
  }
  const handbooks = Object.entries(content.HANDBOOKS).map(([handbookId, meta]) => ({
    id: handbookId,
    ...meta,
    pages: content.listPages(year.yearId, handbookId),
  }));
  res.render('public/home', { title: 'Handbooks', year, years, handbooks });
});

router.get('/handbook/:handbookId', (req, res) => {
  const { handbookId } = req.params;
  const meta = content.HANDBOOKS[handbookId];
  if (!meta) return res.status(404).render('error', { title: 'Not found', message: 'Unknown handbook.' });

  const year = resolveYear(req);
  if (!year) return res.render('public/home-empty', { title: 'Welcome' });

  const pages = content.listPages(year.yearId, handbookId);
  const years = content.listYears().filter((y) => y.published && !y.archived);
  const first = pages[0];
  // A handbook with no pages yet shows a friendly placeholder instead of an error.
  if (!first) {
    return res.render('public/handbook-empty', { title: meta.name, handbook: meta, year, years });
  }
  const firstHtml = require('marked').parse(first.body);
  const { html: firstAnchored, toc: pageToc } = content.withHeadingAnchors(firstHtml);
  res.render('public/page', {
    title: first.title,
    handbook: meta,
    page: first,
    year,
    years,
    pages,
    allHandbooks: content.HANDBOOKS,
    html: firstAnchored,
    pageToc,
    prevPage: null,
    nextPage: pages[1] || null,
  });
});

router.get('/handbook/:handbookId/:slug', (req, res) => {
  const { handbookId, slug } = req.params;
  const meta = content.HANDBOOKS[handbookId];
  if (!meta) return res.status(404).render('error', { title: 'Not found', message: 'Unknown handbook.' });

  const year = resolveYear(req);
  if (!year) return res.render('public/home-empty', { title: 'Welcome' });

  const pages = content.listPages(year.yearId, handbookId);
  const page = pages.find((p) => p.slug === slug);
  if (!page) {
    return res
      .status(404)
      .render('error', { title: 'Page not found', message: `No page "${slug}" in the ${meta.name} for ${year.title}.` });
  }
  const years = content.listYears().filter((y) => y.published && !y.archived);
  const marked = require('marked');
  const { html, toc: pageToc } = content.withHeadingAnchors(marked.parse(page.body));
  const idx = pages.findIndex((p) => p.id === page.id);
  res.render('public/page', {
    title: page.title,
    handbook: meta,
    page,
    year,
    years,
    pages,
    allHandbooks: content.HANDBOOKS,
    html,
    pageToc,
    prevPage: idx > 0 ? pages[idx - 1] : null,
    nextPage: idx < pages.length - 1 ? pages[idx + 1] : null,
  });
});

router.get('/search', (req, res) => {
  const year = resolveYear(req);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  let results = year && q ? search.searchYear(year.yearId, q) : [];
  results = results.map((r) => ({ ...r, excerptHtml: highlightExcerpt(r.excerpt, q) }));
  const years = content.listYears().filter((y) => y.published && !y.archived);
  res.render('public/search', { title: 'Search', year, years, q, results });
});

router.get('/print/:yearId', (req, res) => {
  const year = content.getYear(req.params.yearId);
  if (!year || !year.published || year.archived) {
    return res.status(404).render('error', { title: 'Not found', message: 'That school year is not available.' });
  }
  res.type('html').send(content.exportYearToHtml(year.yearId));
});

router.get('/export/:yearId', (req, res) => {
  const year = content.getYear(req.params.yearId);
  if (!year || !year.published || year.archived) {
    return res.status(404).render('error', { title: 'Not found', message: 'That school year is not available.' });
  }
  const out = content.exportYearToFile(year.yearId);
  res.download(out, `${year.yearId}-handbooks.html`);
});

module.exports = router;
