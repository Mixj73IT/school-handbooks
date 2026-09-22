'use strict';

const express = require('express');
const config = require('../../config');
const content = require('../content');
const users = require('../users');

const router = express.Router();
router.use(require('../middleware').csrfCheck);

// ------------------------------------------------------------ dashboard ----

router.get('/', (req, res) => {
  const years = content.listYears();
  const activeYear = content.getYear(req.session.adminYearId) || years[0] || null;
  const handbooks = Object.entries(content.HANDBOOKS).map(([handbookId, meta]) => ({
    id: handbookId,
    ...meta,
    pages: activeYear ? content.listPages(activeYear.yearId, handbookId) : [],
  }));
  res.render('admin/dashboard', {
    title: 'Dashboard',
    years,
    activeYear,
    handbooks,
    allUsers: users.loadUsers().map(users.publicUser),
    settings: config.SCHOOL_NAME,
    adminYearId: req.session.adminYearId || null,
    yearError: null,
    userError: null,
    userSuccess: null,
    settingsSaved: null,
  });
});

// Select the year the admin is currently working on (sticky in session).
router.post('/select-year', (req, res) => {
  const { yearId } = req.body;
  if (content.yearExists(yearId)) req.session.adminYearId = yearId;
  res.redirect('/admin');
});

// ---------------------------------------------------------------- years ----

router.post('/years', (req, res) => {
  const { yearId, title } = req.body;
  try {
    content.createYear(yearId, title);
    req.session.adminYearId = yearId;
  } catch (err) {
    return reRenderDashboardWithError(res, req, String(err.message));
  }
  res.redirect(`/admin?created=${encodeURIComponent(yearId)}`);
});

router.post('/years/:yearId/duplicate', (req, res) => {
  const { yearId } = req.params;
  const target = typeof req.body.targetYearId === 'string' && /^\d{4}-\d{4}$/.test(req.body.targetYearId)
    ? req.body.targetYearId
    : nextYearAfter(yearId);
  try {
    content.duplicateYear(yearId, target);
    req.session.adminYearId = target;
  } catch (err) {
    return reRenderDashboardWithError(res, req, String(err.message));
  }
  res.redirect(`/admin?duplicated=${encodeURIComponent(target)}`);
});

router.post('/years/:yearId/update', (req, res) => {
  try {
    content.updateYear(req.params.yearId, req.body);
  } catch (err) {
    return reRenderDashboardWithError(res, req, String(err.message));
  }
  res.redirect(`/admin?yearUpdated=${req.body.published === '1' ? 'published' : 'unpublished'}`);
});

router.post('/years/:yearId/delete', (req, res) => {
  try {
    content.deleteYear(req.params.yearId);
    if (req.session.adminYearId === req.params.yearId) delete req.session.adminYearId;
  } catch (err) {
    return reRenderDashboardWithError(res, req, String(err.message));
  }
  res.redirect('/admin?yearDeleted=1');
});

// "Start next year" convenience: duplicates the newest year into the next one.
function nextYearAfter(yearId) {
  const [start, end] = String(yearId).split('-').map(Number);
  return `${start + 1}-${end + 1}`;
}

// ---------------------------------------------------------------- pages ----

router.get('/pages/:handbookId', (req, res) => {
  const { handbookId } = req.params;
  const meta = content.HANDBOOKS[handbookId];
  if (!meta) return res.status(404).render('error', { title: 'Not found', message: 'Unknown handbook.' });
  const years = content.listYears();
  const year = content.getYear(req.session.adminYearId) || years[0] || null;
  if (!year) return res.redirect('/admin');
  const pages = content.listPages(year.yearId, handbookId);
  res.render('admin/pages', { title: meta.name, handbook: meta, year, years, pages });
});

router.get('/pages/:handbookId/new', (req, res) => {
  const { handbookId } = req.params;
  const meta = content.HANDBOOKS[handbookId];
  if (!meta) return res.status(404).render('error', { title: 'Not found', message: 'Unknown handbook.' });
  const year = content.getYear(req.session.adminYearId) || content.listYears()[0] || null;
  if (!year) return res.redirect('/admin');
  res.render('admin/page-form', {
    title: 'New page',
    handbook: meta,
    year,
    page: null,
    error: null,
  });
});

router.post('/pages/:handbookId/new', (req, res) => {
  const { handbookId } = req.params;
  const meta = content.HANDBOOKS[handbookId];
  if (!meta) return res.status(404).render('error', { title: 'Not found', message: 'Unknown handbook.' });
  const year = content.getYear(req.session.adminYearId) || content.listYears()[0] || null;
  if (!year) return res.redirect('/admin');
  try {
    const page = content.createPage(year.yearId, handbookId, req.body);
    return res.redirect(`/admin/pages/${handbookId}?created=${encodeURIComponent(page.title)}`);
  } catch (err) {
    return res.status(400).render('admin/page-form', {
      title: 'New page',
      handbook: meta,
      year,
      page: { title: req.body.title, slug: req.body.slug, body: req.body.body },
      error: err.message,
    });
  }
});

router.get('/pages/:handbookId/:pageId/edit', (req, res) => {
  const { handbookId, pageId } = req.params;
  const meta = content.HANDBOOKS[handbookId];
  const year = content.getYear(req.session.adminYearId) || content.listYears()[0] || null;
  if (!meta || !year) return res.status(404).render('error', { title: 'Not found', message: 'Not found.' });
  const page = content.getPage(year.yearId, handbookId, pageId);
  if (!page) return res.status(404).render('error', { title: 'Not found', message: 'Page not found.' });
  res.render('admin/page-form', { title: 'Edit page', handbook: meta, year, page, error: null });
});

router.post('/pages/:handbookId/:pageId/edit', (req, res) => {
  const { handbookId, pageId } = req.params;
  const meta = content.HANDBOOKS[handbookId];
  const year = content.getYear(req.session.adminYearId) || content.listYears()[0] || null;
  if (!meta || !year) return res.status(404).render('error', { title: 'Not found', message: 'Not found.' });
  try {
    content.updatePage(year.yearId, handbookId, pageId, req.body);
    return res.redirect(`/admin/pages/${handbookId}?updated=${encodeURIComponent(req.body.title || 'Page')}`);
  } catch (err) {
    const page = { title: req.body.title, slug: req.body.slug, body: req.body.body };
    return res.status(400).render('admin/page-form', { title: 'Edit page', handbook: meta, year, page, error: err.message });
  }
});

router.post('/pages/:handbookId/:pageId/delete', (req, res) => {
  const { handbookId, pageId } = req.params;
  const year = content.getYear(req.session.adminYearId) || content.listYears()[0] || null;
  if (!year) return res.redirect('/admin');
  const page = content.getPage(year.yearId, handbookId, pageId);
  const pageTitle = page ? page.title : 'Page';
  content.deletePage(year.yearId, handbookId, pageId);
  res.redirect(`/admin/pages/${handbookId}?deleted=${encodeURIComponent(pageTitle)}`);
});

router.post('/pages/:handbookId/:pageId/move', (req, res) => {
  const { handbookId, pageId } = req.params;
  const year = content.getYear(req.session.adminYearId) || content.listYears()[0] || null;
  if (!year) return res.redirect('/admin');
  try {
    content.movePage(year.yearId, handbookId, pageId, req.body.direction === 'up' ? 'up' : 'down');
  } catch {
    // Ignore invalid moves; just refresh the list.
  }
  res.redirect(`/admin/pages/${handbookId}`);
});

// ---------------------------------------------------------------- users ----

router.post('/users', (req, res) => {
  const { username, name, password, role } = req.body;
  try {
    users.createUser({ username, name, password, role: role === 'admin' ? 'admin' : 'editor' });
    return reRenderDashboard(res, req, { userSuccess: `Created user "${username}".` });
  } catch (err) {
    return reRenderDashboard(res, req, { userError: String(err.message) });
  }
});

router.post('/users/:id/update', (req, res) => {
  try {
    users.updateUser(req.params.id, req.body);
    return reRenderDashboard(res, req, { userSuccess: 'User updated.' });
  } catch (err) {
    return reRenderDashboard(res, req, { userError: String(err.message) });
  }
});

router.post('/users/:id/delete', (req, res) => {
  try {
    users.deleteUser(req.params.id);
    return reRenderDashboard(res, req, { userSuccess: 'User removed.' });
  } catch (err) {
    return reRenderDashboard(res, req, { userError: err.message });
  }
});

// ------------------------------------------------------------- settings ----

router.post('/settings', (req, res) => {
  config.SCHOOL_NAME = String(req.body.schoolName || '').trim() || config.SCHOOL_NAME;
  reRenderDashboard(res, req, { settingsSaved: 'Settings saved. Restart to persist the school name via SCHOOL_NAME env var.' });
});

// -------------------------------------------------------------- helpers ----

// Re-render the dashboard after a POST failed or succeeded, preserving context.
function reRenderDashboard(res, req, overrides = {}) {
  const years = content.listYears();
  const activeYear = content.getYear(req.session.adminYearId) || years[0] || null;
  const handbooks = Object.entries(content.HANDBOOKS).map(([handbookId, meta]) => ({
    id: handbookId,
    ...meta,
    pages: activeYear ? content.listPages(activeYear.yearId, handbookId) : [],
  }));
  res.render('admin/dashboard', {
    title: 'Dashboard',
    years,
    activeYear,
    handbooks,
    allUsers: users.loadUsers().map(users.publicUser),
    settings: config.SCHOOL_NAME,
    adminYearId: req.session.adminYearId || null,
    yearError: null,
    userError: null,
    userSuccess: null,
    settingsSaved: null,
    ...overrides,
  });
}

function reRenderDashboardWithError(res, req, message) {
  return reRenderDashboard(res, req, { yearError: message });
}

module.exports = router;
